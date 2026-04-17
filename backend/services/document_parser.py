import os
import zlib
import struct
import zipfile
import fitz  # pymupdf
from docx import Document


def parse_file(file_path: str) -> tuple[str, list[dict]]:
    """
    파일을 파싱해서 (전체 텍스트, 페이지별 메타데이터 리스트) 반환
    페이지 메타데이터: {"text": str, "page": int}  (페이지 구분이 없으면 page=None)
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        return _parse_pdf(file_path)
    elif ext == ".txt":
        text = _parse_txt(file_path)
        return text, [{"text": text, "page": None}]
    elif ext == ".docx":
        text = _parse_docx(file_path)
        return text, [{"text": text, "page": None}]
    elif ext == ".hwp":
        text = _parse_hwp(file_path)
        return text, [{"text": text, "page": None}]
    elif ext == ".hwpx":
        text = _parse_hwpx(file_path)
        return text, [{"text": text, "page": None}]
    else:
        raise ValueError(f"지원하지 않는 파일 형식입니다: {ext}")


def _parse_pdf(file_path: str) -> tuple[str, list[dict]]:
    doc = fitz.open(file_path)
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text() or ""
        if text.strip():
            pages.append({"text": text, "page": i + 1})
    doc.close()
    full_text = "\n".join(p["text"] for p in pages)
    return full_text, pages


def _parse_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def _parse_docx(file_path: str) -> str:
    doc = Document(file_path)
    return "\n".join(para.text for para in doc.paragraphs if para.text.strip())


def _parse_hwp(file_path: str) -> str:
    import olefile

    try:
        ole = olefile.OleFileIO(file_path)
    except Exception:
        raise ValueError("HWP 파일을 읽을 수 없습니다.")

    texts = []
    section_idx = 0

    while True:
        section_name = f"BodyText/Section{section_idx}"
        if not ole.exists(section_name):
            break

        data = ole.openstream(section_name).read()
        try:
            data = zlib.decompress(data, -15)
        except Exception:
            pass

        pos = 0
        while pos + 4 <= len(data):
            header = struct.unpack_from("<I", data, pos)[0]
            tag_id = header & 0x3FF
            size = (header >> 20) & 0xFFF
            pos += 4

            if size == 0xFFF:
                if pos + 4 <= len(data):
                    size = struct.unpack_from("<I", data, pos)[0]
                    pos += 4

            if tag_id == 67:
                try:
                    text = data[pos : pos + size].decode("utf-16-le", errors="ignore")
                    if text.strip():
                        texts.append(text)
                except Exception:
                    pass

            pos += size
        section_idx += 1

    if not texts:
        raise ValueError("HWP 파일에서 텍스트를 추출할 수 없습니다.")
    return "\n".join(texts)


def _parse_hwpx(file_path: str) -> str:
    import xml.etree.ElementTree as ET

    texts = []
    try:
        with zipfile.ZipFile(file_path, "r") as z:
            section_files = sorted(
                [f for f in z.namelist() if f.startswith("Contents/section") and f.endswith(".xml")]
            )
            for section_file in section_files:
                xml_data = z.read(section_file).decode("utf-8", errors="ignore")
                root = ET.fromstring(xml_data)
                for elem in root.iter():
                    if elem.text and elem.text.strip():
                        texts.append(elem.text.strip())
    except Exception as e:
        raise ValueError(f"HWPX 파일을 읽을 수 없습니다: {e}")

    if not texts:
        raise ValueError("HWPX 파일에서 텍스트를 추출할 수 없습니다.")
    return "\n".join(texts)


MIN_CHUNK_SIZE = 100  # 이보다 짧은 청크는 버림


def split_into_chunks(
    pages: list[dict], chunk_size: int = 500, overlap: int = 50
) -> list[dict]:
    """
    페이지별 텍스트를 청크로 분할
    반환: [{"text": str, "page": int|None, "chunk_index": int}]
    """
    chunks = []
    chunk_index = 0

    for page_info in pages:
        text = page_info["text"].strip()
        page = page_info["page"]
        start = 0

        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]

            if end < len(text):
                last_period = max(chunk.rfind("."), chunk.rfind("\n"))
                if last_period > chunk_size // 2:
                    end = start + last_period + 1
                    chunk = text[start:end]

            # MIN_CHUNK_SIZE 미만은 의미있는 내용이 없으므로 건너뜀
            if len(chunk.strip()) >= MIN_CHUNK_SIZE:
                chunks.append({
                    "text": chunk.strip(),
                    "page": page,
                    "chunk_index": chunk_index,
                })
                chunk_index += 1

            start = end - overlap

    return chunks
