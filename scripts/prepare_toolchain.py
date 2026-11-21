import hashlib
import pathlib
import tarfile
import tempfile
import urllib.request

from pack_wasi_sysroot import pack


VERSION = "34.0"
URL = (
    "https://github.com/WebAssembly/wasi-sdk/releases/download/"
    f"wasi-sdk-34/wasi-sysroot-{VERSION}.tar.gz"
)
SHA256 = "9d813544eeebe38b7b8f2244ed591de46b6db812c6dd1a257ff9f0d2a905a2be"
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "web" / "public" / "toolchain" / "sysroot.pack"


def main():
    with tempfile.TemporaryDirectory(prefix="sort-wasi-") as temporary:
        archive = pathlib.Path(temporary) / "wasi-sysroot.tar.gz"
        print(f"Downloading pinned WASI sysroot {VERSION}...")
        urllib.request.urlretrieve(URL, archive)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        if digest != SHA256:
            raise RuntimeError(f"WASI sysroot checksum mismatch: {digest}")

        with tarfile.open(archive, "r:gz") as source:
            source.extractall(temporary)

        sysroot = pathlib.Path(temporary) / f"wasi-sysroot-{VERSION}"
        if not sysroot.is_dir():
            raise RuntimeError("The downloaded archive did not contain the expected sysroot.")
        pack(sysroot, OUTPUT)


if __name__ == "__main__":
    main()
