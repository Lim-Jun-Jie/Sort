cmake_minimum_required(VERSION 3.20)
project(sort_visualizer LANGUAGES CXX)

add_library(sort_core STATIC
    src/sort_core.cpp
)
target_include_directories(sort_core PUBLIC src)
target_compile_features(sort_core PUBLIC cxx_std_17)

if(EMSCRIPTEN)
    file(MAKE_DIRECTORY "${CMAKE_SOURCE_DIR}/web/public/build-wasm")

    add_executable(sort_core_wasm src/wasm_api.cpp)
    target_link_libraries(sort_core_wasm PRIVATE sort_core)
    set_target_properties(sort_core_wasm PROPERTIES
        OUTPUT_NAME sort_core
        RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/web/public/build-wasm"
        SUFFIX ".js"
    )
    target_link_options(sort_core_wasm PRIVATE
        "--no-entry"
        "-sMODULARIZE=1"
        "-sEXPORT_NAME=createSortModule"
        "-sENVIRONMENT=web"
        "-sALLOW_MEMORY_GROWTH=1"
        "-sEXPORTED_FUNCTIONS=['_sort_trace','_malloc','_free']"
        "-sEXPORTED_RUNTIME_METHODS=['ccall']"
    )
endif()

include(CTest)
if(BUILD_TESTING AND NOT EMSCRIPTEN)
    add_executable(sort_core_tests
        tests/sort_core_tests.cpp
        src/wasm_api.cpp
    )
    target_link_libraries(sort_core_tests PRIVATE sort_core)
    add_test(NAME sort_core_tests COMMAND sort_core_tests)
endif()
