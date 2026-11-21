#pragma once

#include <string>
#include <vector>

namespace sorting {

enum class OperationType {
    Compare,
    Swap,
    Write,
    MarkSorted,
    Complete
};

struct Operation {
    OperationType type;
    int first;
    int second;
    int value;
    int sequence;
};

struct SortResult {
    std::vector<int> values;
    std::vector<Operation> operations;
};

std::vector<std::string> algorithm_ids();
SortResult run_sort(const std::string& algorithm, const std::vector<int>& input);

}
