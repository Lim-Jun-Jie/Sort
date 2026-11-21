#include "sort_core.h"

#include <algorithm>
#include <cstdint>
#include <functional>
#include <map>
#include <stdexcept>
#include <utility>

namespace sorting {
namespace {

thread_local std::vector<Operation>* active_operations = nullptr;

void record_operation(OperationType type, int first, int second, int value) {
    if (active_operations == nullptr) {
        return;
    }
    active_operations->push_back({type, first, second, value,
                                  static_cast<int>(active_operations->size())});
}

class TraceScope {
public:
    explicit TraceScope(std::vector<Operation>& operations)
        : previous_(active_operations) {
        active_operations = &operations;
    }

    ~TraceScope() {
        active_operations = previous_;
    }

private:
    std::vector<Operation>* previous_;
};

class InstrumentedArray {
public:
    explicit InstrumentedArray(std::vector<int> input) : values(std::move(input)) {}

    bool less(int first, int second) {
        record_operation(OperationType::Compare, first, second, values[second]);
        return values[first] < values[second];
    }

    bool less_than_value(int index, int value) {
        record_operation(OperationType::Compare, index, -1, value);
        return values[index] < value;
    }

    bool greater_than_value(int index, int value) {
        record_operation(OperationType::Compare, index, -1, value);
        return values[index] > value;
    }

    void swap(int first, int second) {
        if (first == second) {
            return;
        }
        record_operation(OperationType::Swap, first, second, values[second]);
        std::swap(values[first], values[second]);
    }

    void write(int index, int value) {
        values[index] = value;
        record_operation(OperationType::Write, index, -1, value);
    }

    void mark_sorted(int index) {
        record_operation(OperationType::MarkSorted, index, -1, values[index]);
    }

    void mark_range_sorted(int first, int last) {
        for (int index = first; index <= last; ++index) {
            mark_sorted(index);
        }
    }

    std::vector<int> values;
};

std::vector<int> bubble_sort(std::vector<int> unsorted) {
    InstrumentedArray array(std::move(unsorted));
    const int size = static_cast<int>(array.values.size());
    for (int end = size - 1; end > 0; --end) {
        bool changed = false;
        for (int index = 0; index < end; ++index) {
            if (array.less(index + 1, index)) {
                array.swap(index, index + 1);
                changed = true;
            }
        }
        array.mark_sorted(end);
        if (!changed) {
            array.mark_range_sorted(0, end - 1);
            return std::move(array.values);
        }
    }
    if (size > 0) {
        array.mark_sorted(0);
    }
    return std::move(array.values);
}

std::vector<int> selection_sort(std::vector<int> unsorted) {
    InstrumentedArray array(std::move(unsorted));
    const int size = static_cast<int>(array.values.size());
    for (int index = 0; index < size; ++index) {
        int minimum = index;
        for (int candidate = index + 1; candidate < size; ++candidate) {
            if (array.less(candidate, minimum)) {
                minimum = candidate;
            }
        }
        array.swap(index, minimum);
        array.mark_sorted(index);
    }
    return std::move(array.values);
}

std::vector<int> insertion_sort(std::vector<int> unsorted) {
    InstrumentedArray array(std::move(unsorted));
    const int size = static_cast<int>(array.values.size());
    for (int index = 1; index < size; ++index) {
        const int value = array.values[index];
        int position = index;
        while (position > 0 && array.greater_than_value(position - 1, value)) {
            array.write(position, array.values[position - 1]);
            --position;
        }
        array.write(position, value);
    }
    array.mark_range_sorted(0, size - 1);
    return std::move(array.values);
}

std::vector<int> merge_sort(std::vector<int> unsorted) {
    InstrumentedArray array(std::move(unsorted));
    std::function<void(int, int)> sort = [&](int first, int last) {
        if (last - first < 2) {
            return;
        }
        const int middle = first + (last - first) / 2;
        sort(first, middle);
        sort(middle, last);

        std::vector<int> merged;
        merged.reserve(static_cast<std::size_t>(last - first));
        int left = first;
        int right = middle;
        while (left < middle && right < last) {
            if (array.less(right, left)) {
                merged.push_back(array.values[right++]);
            } else {
                merged.push_back(array.values[left++]);
            }
        }
        while (left < middle) {
            merged.push_back(array.values[left++]);
        }
        while (right < last) {
            merged.push_back(array.values[right++]);
        }
        for (int offset = 0; offset < last - first; ++offset) {
            array.write(first + offset, merged[static_cast<std::size_t>(offset)]);
        }
    };

    sort(0, static_cast<int>(array.values.size()));
    array.mark_range_sorted(0, static_cast<int>(array.values.size()) - 1);
    return std::move(array.values);
}

std::vector<int> quick_sort(std::vector<int> unsorted) {
    InstrumentedArray array(std::move(unsorted));
    std::function<void(int, int)> sort = [&](int low, int high) {
        if (low >= high) {
            if (low == high) {
                array.mark_sorted(low);
            }
            return;
        }
        const int pivot = array.values[low + (high - low) / 2];
        int left = low;
        int right = high;
        while (left <= right) {
            while (left <= high && array.less_than_value(left, pivot)) {
                ++left;
            }
            while (right >= low && array.greater_than_value(right, pivot)) {
                --right;
            }
            if (left <= right) {
                array.swap(left, right);
                ++left;
                --right;
            }
        }
        if (low < right) {
            sort(low, right);
        }
        if (left < high) {
            sort(left, high);
        }
    };

    sort(0, static_cast<int>(array.values.size()) - 1);
    array.mark_range_sorted(0, static_cast<int>(array.values.size()) - 1);
    return std::move(array.values);
}

std::vector<int> heap_sort(std::vector<int> unsorted) {
    InstrumentedArray array(std::move(unsorted));
    const int size = static_cast<int>(array.values.size());
    auto sift_down = [&](int root, int end, auto&& self) -> void {
        int largest = root;
        const int left = root * 2 + 1;
        const int right = left + 1;
        if (left < end && array.less(largest, left)) {
            largest = left;
        }
        if (right < end && array.less(largest, right)) {
            largest = right;
        }
        if (largest != root) {
            array.swap(root, largest);
            self(largest, end, self);
        }
    };

    for (int root = size / 2 - 1; root >= 0; --root) {
        sift_down(root, size, sift_down);
    }
    for (int end = size - 1; end > 0; --end) {
        array.swap(0, end);
        array.mark_sorted(end);
        sift_down(0, end, sift_down);
    }
    if (size > 0) {
        array.mark_sorted(0);
    }
    return std::move(array.values);
}

std::vector<int> shell_sort(std::vector<int> unsorted) {
    InstrumentedArray array(std::move(unsorted));
    const int size = static_cast<int>(array.values.size());
    for (int gap = size / 2; gap > 0; gap /= 2) {
        for (int index = gap; index < size; ++index) {
            const int value = array.values[index];
            int position = index;
            while (position >= gap &&
                   array.greater_than_value(position - gap, value)) {
                array.write(position, array.values[position - gap]);
                position -= gap;
            }
            array.write(position, value);
        }
    }
    array.mark_range_sorted(0, size - 1);
    return std::move(array.values);
}

std::vector<int> counting_sort(std::vector<int> unsorted) {
    InstrumentedArray array(std::move(unsorted));
    if (array.values.empty()) {
        return std::move(array.values);
    }
    const auto bounds = std::minmax_element(array.values.begin(), array.values.end());
    const int minimum = *bounds.first;
    const std::int64_t range = static_cast<std::int64_t>(*bounds.second) -
                               static_cast<std::int64_t>(minimum) + 1;
    if (range > 1000000) {
        throw std::invalid_argument("Counting sort supports value ranges up to 1,000,000.");
    }
    std::vector<int> counts(static_cast<std::size_t>(range), 0);
    for (int value : array.values) {
        ++counts[static_cast<std::size_t>(static_cast<std::int64_t>(value) -
                                          minimum)];
    }
    int index = 0;
    for (std::size_t bucket = 0; bucket < counts.size(); ++bucket) {
        while (counts[bucket]-- > 0) {
            array.write(index, static_cast<int>(minimum +
                                                static_cast<std::int64_t>(bucket)));
            array.mark_sorted(index++);
        }
    }
    return std::move(array.values);
}

std::vector<int> radix_sort(std::vector<int> unsorted) {
    InstrumentedArray array(std::move(unsorted));
    std::vector<int> output(array.values.size());
    for (unsigned shift = 0; shift < 32; shift += 8) {
        std::size_t counts[256] = {};
        for (int value : array.values) {
            const auto key = static_cast<std::uint32_t>(value) ^ 0x80000000u;
            ++counts[(key >> shift) & 0xffu];
        }
        for (std::size_t index = 1; index < 256; ++index) {
            counts[index] += counts[index - 1];
        }
        for (std::size_t index = array.values.size(); index > 0; --index) {
            const auto value = array.values[index - 1];
            const auto key = static_cast<std::uint32_t>(value) ^ 0x80000000u;
            output[--counts[(key >> shift) & 0xffu]] = value;
        }
        for (std::size_t index = 0; index < output.size(); ++index) {
            array.write(static_cast<int>(index), output[index]);
        }
    }
    array.mark_range_sorted(0, static_cast<int>(array.values.size()) - 1);
    return std::move(array.values);
}

using SortFunction = std::vector<int> (*)(std::vector<int>);

const std::map<std::string, SortFunction>& algorithms() {
    static const std::map<std::string, SortFunction> registered = {
        {"bubble", bubble_sort},
        {"counting", counting_sort},
        {"heap", heap_sort},
        {"insertion", insertion_sort},
        {"merge", merge_sort},
        {"quick", quick_sort},
        {"radix", radix_sort},
        {"selection", selection_sort},
        {"shell", shell_sort},
    };
    return registered;
}

}

std::vector<std::string> algorithm_ids() {
    std::vector<std::string> ids;
    for (const auto& entry : algorithms()) {
        ids.push_back(entry.first);
    }
    return ids;
}

SortResult run_sort(const std::string& algorithm, const std::vector<int>& input) {
    const auto found = algorithms().find(algorithm);
    if (found == algorithms().end()) {
        throw std::invalid_argument("Unknown sorting algorithm: " + algorithm);
    }

    SortResult result;
    TraceScope trace_scope(result.operations);
    result.values = found->second(input);
    record_operation(OperationType::Complete, -1, -1, 0);
    return result;
}

}
