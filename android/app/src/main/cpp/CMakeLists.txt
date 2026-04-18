cmake_minimum_required(VERSION 3.22.1)

# appmodules is the New Architecture TurboModule registration library required by RN 0.82.
project(appmodules)

# Build appmodules (OnLoad.cpp + autolinking) using RN's cmake helper.
# REACT_ANDROID_DIR and PROJECT_BUILD_DIR are injected by the React Native Gradle Plugin.
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# Build the video analysis native library separately.
add_library(gainalytics_native SHARED native/yuv_to_rgb.cpp)

if(ANDROID_ABI STREQUAL "arm64-v8a")
    target_compile_options(gainalytics_native PRIVATE
        -O3
        -ffast-math
        -march=armv8-a+simd
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
