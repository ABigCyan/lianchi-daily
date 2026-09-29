# 内置大模型：编译 llama.cpp（只要库，不要工具）+ JNI 桥 llm.cpp
cmake_minimum_required(VERSION 3.22.1)
project(lianchi_llm C CXX)

set(LLAMA_DIR ${CMAKE_CURRENT_SOURCE_DIR}/llama.cpp)
if(NOT EXISTS ${LLAMA_DIR}/CMakeLists.txt)
  message(FATAL_ERROR "没有 llama.cpp 源码：先运行 tools/fetch-llama.sh")
endif()

set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
# 骁龙 855 以后的手机都支持 dotprod 和 fp16；更老的 CPU 在 Java 端检测后不加载
set(GGML_CPU_ARM_ARCH "armv8.2-a+dotprod+fp16" CACHE STRING "" FORCE)
set(LLAMA_BUILD_COMMON OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_APP OFF CACHE BOOL "" FORCE)
set(LLAMA_CURL OFF CACHE BOOL "" FORCE)
add_subdirectory(${LLAMA_DIR} llama)

add_library(lianchi_llm SHARED llm.cpp)
target_compile_features(lianchi_llm PRIVATE cxx_std_17)
target_link_libraries(lianchi_llm PRIVATE llama log android)
