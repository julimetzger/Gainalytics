/**
 * Native YUV→RGB letterbox conversion for TFLite input.
 *
 * Replaces the Java imageToLetterboxedFloatDirect() inner loop.
 * Speedups vs Java:
 *   - No JNI overhead per pixel (direct pointer arithmetic)
 *   - No bounds-check overhead
 *   - Compiler (clang -O3) auto-vectorises the content-region inner loop with NEON
 *   - Explicit NEON for uint8→float32 normalisation
 *   - Lookup tables eliminate repeated scale/pad arithmetic from the inner loop
 *
 * BT.601 limited-range YUV→RGB (matches the Java yuvToArgb() method):
 *   adjY = max(0, Y-16)
 *   adjU = U-128, adjV = V-128
 *   R = clamp((298*adjY + 409*adjV + 128) >> 8, 0, 255)
 *   G = clamp((298*adjY - 100*adjU - 208*adjV + 128) >> 8, 0, 255)
 *   B = clamp((298*adjY + 516*adjU + 128) >> 8, 0, 255)
 */

#include <jni.h>
#include <cstdint>
#include <cstring>
#include <algorithm>
#if defined(__aarch64__) || defined(__ARM_NEON)
#include <arm_neon.h>
#define HAVE_NEON 1
#endif

#define MODEL_INPUT_SIZE 320

static const float kInv255 = 1.0f / 255.0f;

// --------------------------------------------------------------------------
// Scalar BT.601 YUV→RGB
// --------------------------------------------------------------------------
static inline void yuv_to_rgb(uint8_t y, uint8_t u, uint8_t v,
                               uint8_t *r_out, uint8_t *g_out, uint8_t *b_out) {
    int adjY = (int)y - 16;
    if (adjY < 0) adjY = 0;
    int adjU = (int)u - 128;
    int adjV = (int)v - 128;
    int ri = (298 * adjY + 409 * adjV             + 128) >> 8;
    int gi = (298 * adjY - 100 * adjU - 208 * adjV + 128) >> 8;
    int bi = (298 * adjY + 516 * adjU             + 128) >> 8;
    *r_out = (uint8_t)(ri < 0 ? 0 : ri > 255 ? 255 : ri);
    *g_out = (uint8_t)(gi < 0 ? 0 : gi > 255 ? 255 : gi);
    *b_out = (uint8_t)(bi < 0 ? 0 : bi > 255 ? 255 : bi);
}

// --------------------------------------------------------------------------
// Write one RGB pixel to the output buffer (uint8 or float32)
// --------------------------------------------------------------------------
static inline void write_rgb(uint8_t *&out, uint8_t r, uint8_t g, uint8_t b,
                              bool is_uint8) {
    if (is_uint8) {
        *out++ = r;
        *out++ = g;
        *out++ = b;
    } else {
#if defined(HAVE_NEON)
        // NEON: convert 3 uint8 → float32 in one pipeline
        uint8x8_t rgb8 = {r, g, b, 0, 0, 0, 0, 0};
        float32x4_t rgb_f = vcvtq_f32_u32(vmovl_u16(vget_low_u16(vmovl_u8(rgb8))));
        rgb_f = vmulq_n_f32(rgb_f, kInv255);
        vst1q_lane_f32(reinterpret_cast<float *>(out),     rgb_f, 0); out += 4;
        vst1q_lane_f32(reinterpret_cast<float *>(out),     rgb_f, 1); out += 4;
        vst1q_lane_f32(reinterpret_cast<float *>(out),     rgb_f, 2); out += 4;
#else
        float *fout = reinterpret_cast<float *>(out);
        fout[0] = r * kInv255;
        fout[1] = g * kInv255;
        fout[2] = b * kInv255;
        out += 12;
#endif
    }
}

static inline void write_black(uint8_t *&out, bool is_uint8) {
    if (is_uint8) {
        *out++ = 0; *out++ = 0; *out++ = 0;
    } else {
        memset(out, 0, 12);
        out += 12;
    }
}

// --------------------------------------------------------------------------
// JNI entry point
//
// Called from VideoAnalysisModule.nativeYuvToLetterboxedRgb().
// Plane data (yArr, uArr, vArr) are the pre-copied Java byte[] caches —
// no extra copy occurs here; GetPrimitiveArrayCritical pins the heap arrays.
// --------------------------------------------------------------------------
extern "C" JNIEXPORT void JNICALL
Java_com_powerliftingworkoutplanner_VideoAnalysisModule_nativeYuvToLetterboxedRgb(
        JNIEnv *env, jobject /* thiz */,
        jbyteArray y_arr, jbyteArray u_arr, jbyteArray v_arr,
        jint enc_w, jint enc_h,
        jint y_rs,  jint y_ps,
        jint u_rs,  jint u_ps,
        jint v_rs,  jint v_ps,
        jint rotation,          // normalised: 0 / 90 / 180 / 270
        jint log_w, jint log_h, // logical (post-rotation) dimensions
        jdouble pad_x_d, jdouble pad_y_d, jdouble scale_d,
        jobject out_buf,        // direct ByteBuffer (nativeOrder)
        jboolean is_uint8       // true → write uint8, false → write float32
) {
    // Resolve the output buffer address BEFORE entering any critical section.
    // GetDirectBufferAddress must not be called while a critical section is held.
    uint8_t *out = reinterpret_cast<uint8_t *>(env->GetDirectBufferAddress(out_buf));

    // Pin the Java byte[] arrays without copying
    const uint8_t *y_plane = reinterpret_cast<const uint8_t *>(
            env->GetPrimitiveArrayCritical(y_arr, nullptr));
    const uint8_t *u_plane = reinterpret_cast<const uint8_t *>(
            env->GetPrimitiveArrayCritical(u_arr, nullptr));
    const uint8_t *v_plane = reinterpret_cast<const uint8_t *>(
            env->GetPrimitiveArrayCritical(v_arr, nullptr));

    const float inv_scale = static_cast<float>(1.0 / scale_d);
    const float pad_x     = static_cast<float>(pad_x_d);
    const float pad_y     = static_cast<float>(pad_y_d);

    // ------------------------------------------------------------------
    // Precompute per-column and per-row logical-pixel index tables.
    // ilx_map[tx] = logical x index, or -1 if in letterbox padding.
    // ily_map[ty] = logical y index, or -1 if in letterbox padding.
    // This moves the (t - pad) * inv_scale arithmetic out of the inner loop.
    // ------------------------------------------------------------------
    int16_t ilx_map[MODEL_INPUT_SIZE];
    int16_t ily_map[MODEL_INPUT_SIZE];

    for (int t = 0; t < MODEL_INPUT_SIZE; t++) {
        float lx = (t - pad_x) * inv_scale;
        ilx_map[t] = (lx >= 0.0f && lx < (float)log_w)
                     ? static_cast<int16_t>(std::min(static_cast<int>(lx), log_w - 1))
                     : -1;
        float ly = (t - pad_y) * inv_scale;
        ily_map[t] = (ly >= 0.0f && ly < (float)log_h)
                     ? static_cast<int16_t>(std::min(static_cast<int>(ly), log_h - 1))
                     : -1;
    }

    // ------------------------------------------------------------------
    // Main loop
    // ------------------------------------------------------------------
    for (int ty = 0; ty < MODEL_INPUT_SIZE; ty++) {
        const int16_t ily = ily_map[ty];

        if (__builtin_expect(ily < 0, 0)) {
            // Entire row is letterbox padding — fill with black
            int bytes = MODEL_INPUT_SIZE * (is_uint8 ? 3 : 12);
            memset(out, 0, bytes);
            out += bytes;
            continue;
        }

        for (int tx = 0; tx < MODEL_INPUT_SIZE; tx++) {
            const int16_t ilx = ilx_map[tx];

            if (__builtin_expect(ilx < 0, 0)) {
                write_black(out, is_uint8);
                continue;
            }

            // Map logical pixel (ilx, ily) → encoded pixel (sx, sy)
            int sx, sy;
            switch (rotation) {
                case 90:
                    sx = ily;
                    sy = enc_h - 1 - ilx;
                    break;
                case 180:
                    sx = enc_w - 1 - ilx;
                    sy = enc_h - 1 - ily;
                    break;
                case 270:
                    sx = enc_w - 1 - ily;
                    sy = ilx;
                    break;
                default: // 0
                    sx = ilx;
                    sy = ily;
                    break;
            }

            // YUV lookup
            const int yi = sy * y_rs + sx * y_ps;
            const int uvx = sx >> 1;
            const int uvy = sy >> 1;
            const int ui  = uvy * u_rs + uvx * u_ps;
            const int vi  = uvy * v_rs + uvx * v_ps;

            uint8_t r, g, b;
            yuv_to_rgb(y_plane[yi], u_plane[ui], v_plane[vi], &r, &g, &b);

            write_rgb(out, r, g, b, is_uint8);
        }
    }

    // Unpin arrays (JNI_ABORT = don't copy back, we only read)
    env->ReleasePrimitiveArrayCritical(v_arr, const_cast<uint8_t *>(v_plane), JNI_ABORT);
    env->ReleasePrimitiveArrayCritical(u_arr, const_cast<uint8_t *>(u_plane), JNI_ABORT);
    env->ReleasePrimitiveArrayCritical(y_arr, const_cast<uint8_t *>(y_plane), JNI_ABORT);
}
