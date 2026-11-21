import gzip
import hashlib
import json
import pathlib
import struct
import sys


def pack(root, output):
    root = pathlib.Path(root).resolve()
    output = pathlib.Path(output).resolve()
    files = []

    for relative_root in ("include/wasm32-wasip1", "lib/wasm32-wasip1"):
        source_root = root / relative_root
        for path in sorted(source_root.rglob("*")):
            if not path.is_file() or path.suffix == ".so":
                continue
            relative = path.relative_to(root).as_posix()
            parts = pathlib.PurePosixPath(relative).parts
            if "noeh" in parts or "llvm-lto" in parts:
                continue
            data = path.read_bytes()
            encoded_path = f"sysroot/{relative}".encode("utf-8")
            files.append(struct.pack("<I", len(encoded_path)) + encoded_path)
            files.append(struct.pack("<I", len(data)) + data)

    packed = bytearray(struct.pack("<I", len(files) // 2))
    for item in files:
        packed.extend(item)

    output.parent.mkdir(parents=True, exist_ok=True)
    compressed = gzip.compress(packed, compresslevel=9, mtime=0)
    output.write_bytes(compressed)
    manifest = {
        "asset": output.name,
        "sha256": hashlib.sha256(compressed).hexdigest(),
        "compressedBytes": len(compressed),
    }
    output.with_name("manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Packed {manifest['compressedBytes']:,} bytes from {len(files) // 2} sysroot files.")


if __name__ == "__main__":
    pack(sys.argv[1], sys.argv[2])
