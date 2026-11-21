#include "sort_core.h"

#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

const char* operation_name(sorting::OperationType type) {
    switch (type) {
    case sorting::OperationType::Compare:
        return "COMPARE";
    case sorting::OperationType::Swap:
        return "SWAP";
    case sorting::OperationType::Write:
        return "WRITE";
    case sorting::OperationType::MarkSorted:
        return "MARK_SORTED";
    case sorting::OperationType::Complete:
        return "COMPLETE";
    }
    return "UNKNOWN";
}

std::string escape_json(const std::string& value) {
    static const char hex[] = "0123456789abcdef";
    std::string escaped;
    for (unsigned char character : value) {
        switch (character) {
        case '"':
            escaped += "\\\"";
            break;
        case '\\':
            escaped += "\\\\";
            break;
        case '\b':
            escaped += "\\b";
            break;
        case '\f':
            escaped += "\\f";
            break;
        case '\n':
            escaped += "\\n";
            break;
        case '\r':
            escaped += "\\r";
            break;
        case '\t':
            escaped += "\\t";
            break;
        default:
            if (character < 0x20) {
                escaped += "\\u00";
                escaped += hex[character >> 4];
                escaped += hex[character & 0x0f];
            } else {
                escaped += static_cast<char>(character);
            }
        }
    }
    return escaped;
}

std::string to_json(const sorting::SortResult& result) {
    std::ostringstream json;
    json << "{\"values\":[";
    for (std::size_t index = 0; index < result.values.size(); ++index) {
        if (index != 0) {
            json << ',';
        }
        json << result.values[index];
    }
    json << "],\"operations\":[";
    for (std::size_t index = 0; index < result.operations.size(); ++index) {
        if (index != 0) {
            json << ',';
        }
        const auto& operation = result.operations[index];
        json << "{\"type\":\"" << operation_name(operation.type)
             << "\",\"first\":" << operation.first
             << ",\"second\":" << operation.second
             << ",\"value\":" << operation.value
             << ",\"sequence\":" << operation.sequence << '}';
    }
    json << "]}";
    return json.str();
}

}

extern "C" const char* sort_trace(const char* algorithm, const int* values,
                                  int length) {
    static std::string response;
    try {
        if (algorithm == nullptr || length < 0 || length > 256 ||
            (length > 0 && values == nullptr)) {
            throw std::invalid_argument("Invalid input (maximum dataset size is 256).");
        }
        std::vector<int> input;
        if (length > 0) {
            input.assign(values, values + length);
        }
        response = to_json(sorting::run_sort(algorithm, input));
    } catch (const std::exception& error) {
        response = "{\"error\":\"" + escape_json(error.what()) + "\"}";
    }
    return response.c_str();
}
