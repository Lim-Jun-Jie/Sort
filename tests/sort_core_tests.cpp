#include "sort_core.h"

#include <algorithm>
#include <iostream>
#include <limits>
#include <random>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

extern "C" const char* sort_trace(const char* algorithm, const int* values,
                                  int length);

namespace {

void require(bool condition, const std::string& message) {
    if (!condition) {
        throw std::runtime_error(message);
    }
}

void test_algorithms() {
    std::vector<std::vector<int>> cases = {
        {},
        {4},
        {5, -2, 5, 0, -9, 3},
        {std::numeric_limits<int>::max(), 0, std::numeric_limits<int>::min(), -1, 1},
    };
    std::mt19937 generator(17);
    std::uniform_int_distribution<int> size_distribution(2, 24);
    std::uniform_int_distribution<int> value_distribution(-100, 100);
    for (int sample = 0; sample < 40; ++sample) {
        std::vector<int> input(static_cast<std::size_t>(size_distribution(generator)));
        for (int& value : input) {
            value = value_distribution(generator);
        }
        cases.push_back(std::move(input));
    }

    const auto ids = sorting::algorithm_ids();
    require(ids.size() == 9, "Expected all nine built-in algorithms.");

    for (const auto& algorithm : ids) {
        for (std::size_t case_index = 0; case_index < cases.size(); ++case_index) {
            if (algorithm == "counting" && case_index == 3) {
                continue;
            }
            const auto& input = cases[case_index];
            auto expected = input;
            std::sort(expected.begin(), expected.end());
            const auto result = sorting::run_sort(algorithm, input);
            require(result.values == expected, algorithm + " did not sort input.");
            require(!result.operations.empty(), algorithm + " produced no trace.");
            require(result.operations.back().type == sorting::OperationType::Complete,
                    algorithm + " trace did not end with COMPLETE.");
            auto replay = input;
            for (std::size_t index = 0; index < result.operations.size(); ++index) {
                const auto& operation = result.operations[index];
                require(operation.sequence == static_cast<int>(index),
                        algorithm + " produced a non-monotonic trace.");
                if (operation.type == sorting::OperationType::Swap) {
                    require(operation.first >= 0 &&
                                operation.first < static_cast<int>(replay.size()) &&
                                operation.second >= 0 &&
                                operation.second < static_cast<int>(replay.size()),
                            algorithm + " emitted an invalid swap.");
                    std::swap(replay[operation.first], replay[operation.second]);
                } else if (operation.type == sorting::OperationType::Write) {
                    require(operation.first >= 0 &&
                                operation.first < static_cast<int>(replay.size()),
                            algorithm + " emitted an invalid write.");
                    replay[operation.first] = operation.value;
                }
            }
            require(replay == result.values, algorithm + " trace cannot reproduce result.");
        }
    }
}

void test_counting_range_guard() {
    bool rejected = false;
    try {
        sorting::run_sort("counting", {std::numeric_limits<int>::min(),
                                       std::numeric_limits<int>::max()});
    } catch (const std::invalid_argument&) {
        rejected = true;
    }
    require(rejected, "Counting sort should reject an impractically large range.");
}

void test_trace_api() {
    const int input[] = {3, 1, 2};
    const std::string trace = sort_trace("insertion", input, 3);
    require(trace.find("\"values\":[1,2,3]") != std::string::npos,
            "Trace API did not return sorted values.");
    require(trace.find("\"type\":\"COMPARE\"") != std::string::npos,
            "Trace API did not serialize comparisons.");
    require(trace.find("\"type\":\"COMPLETE\"") != std::string::npos,
            "Trace API did not serialize completion.");

    const std::string empty_trace = sort_trace("bubble", nullptr, 0);
    require(empty_trace.find("\"values\":[]") != std::string::npos,
            "Trace API did not accept an empty input.");

    const std::string error = sort_trace("missing", input, 3);
    require(error.find("\"error\":\"Unknown sorting algorithm") !=
                std::string::npos,
            "Trace API did not return an explicit error.");

    const std::string invalid_id = "bad\nid";
    const std::string escaped_error = sort_trace(invalid_id.c_str(), input, 3);
    require(escaped_error.find("bad\\nid") != std::string::npos,
            "Trace API did not escape JSON control characters.");
}

}

int main() {
    try {
        test_algorithms();
        test_counting_range_guard();
        test_trace_api();
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
    return 0;
}
