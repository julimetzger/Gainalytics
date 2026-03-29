cmake_minimum_required(VERSION 3.22.1)
project(gainalytics_native)

add_library(
    gainalytics_native
    SHARED
    yuv_to_rgb.cpp
)

# -O3: full optimisation (enables auto-vectorisation with NEON on arm64)
# -ffast-math: allows reciprocal approximation for the /255 division
if(ANDROID_ABI STREQUAL "arm64-v8a")
    target_compile_options(gainalytics_native PRIVATE
        -O3
        -ffast-math
        -march=armv8-a+simd   # ARMv8 with NEON guaranteed on all arm64 Android devices
    )
else()
    target_compile_options(gainalytics_native PRIVATE
        -O3
        -ffast-math
    )
endif()

target_link_libraries(gainalytics_native
    android
    log
)
