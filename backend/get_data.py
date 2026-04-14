import os
from datasets import load_dataset

def prepare_rag_test_data(limit=5000):
    print("🚀 데이터셋 다운로드 및 추출 시작...")
    # KLUE MRC 데이터셋 불러오기
    dataset = load_dataset("klue", "mrc", split="train")
    
    output_dir = "rag_test_docs"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    print(f"📦 총 {len(dataset)}개 중 {limit}개를 .txt 파일로 저장합니다.")
    
    for i, data in enumerate(dataset):
        if i >= limit:
            break
        # 각 뉴스 기사의 본문을 파일로 저장
        file_path = os.path.join(output_dir, f"doc_{i:04d}.txt")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(data['context'])
            
    print(f"✅ 완료! '{output_dir}' 폴더에 파일들이 생성되었습니다.")

if __name__ == "__main__":
    prepare_rag_test_data(limit=5000)

