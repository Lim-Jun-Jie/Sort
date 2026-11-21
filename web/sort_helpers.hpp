#pragma once

#include <cstddef>
#include <utility>
#include <vector>

extern "C" {
__attribute__((import_module("sortviz"), import_name("size")))
int sortviz_size();
__attribute__((import_module("sortviz"), import_name("read")))
int sortviz_read(int index);
__attribute__((import_module("sortviz"), import_name("compare")))
int sortviz_compare(int first, int second);
__attribute__((import_module("sortviz"), import_name("compare_value")))
int sortviz_compare_value(int index, int value);
__attribute__((import_module("sortviz"), import_name("swap")))
void sortviz_swap(int first, int second);
__attribute__((import_module("sortviz"), import_name("write")))
void sortviz_write(int index, int value);
__attribute__((import_module("sortviz"), import_name("mark_sorted")))
void sortviz_mark_sorted(int index);
__attribute__((import_module("sortviz"), import_name("validate_result_size")))
void sortviz_validate_result_size(int size);
}

namespace sortviz {

inline int compare(const std::vector<int>&, int first, int second) {
    return sortviz_compare(first, second);
}

inline int compareValue(const std::vector<int>&, int index, int value) {
    return sortviz_compare_value(index, value);
}

inline void swap(std::vector<int>& values, int first, int second) {
    sortviz_swap(first, second);
    std::swap(values.at(static_cast<std::size_t>(first)),
              values.at(static_cast<std::size_t>(second)));
}

inline void write(std::vector<int>& values, int index, int value) {
    sortviz_write(index, value);
    values.at(static_cast<std::size_t>(index)) = value;
}

inline void markSorted(int index) {
    sortviz_mark_sorted(index);
}

}
