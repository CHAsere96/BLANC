# BLUSH Lookbook — GitHub Pages

화이트 / 파스텔 핑크 / 블랙 화보집 정적 사이트입니다.

공개 주소 예시: `https://아이디.github.io/저장소이름/`

## 올리는 방법

1. [github.com](https://github.com)에서 새 저장소를 만듭니다. (Public)
2. 이 폴더 안의 파일 전부를 저장소 루트에 올립니다.
   - `index.html`이 맨 위에 있어야 합니다.
3. 저장소 **Settings → Pages**
4. Source: **Deploy from a branch**
5. Branch: `main` / folder: `/ (root)` → Save
6. 1–2분 뒤 Pages에 나온 URL로 접속합니다.

GitHub Desktop이나 웹 업로드(Add file → Upload files)로도 됩니다.

## 내 사진으로 바꾸기

`images/` 파일만 같은 이름으로 덮어쓰면 됩니다.

| 파일 | 용도 | 권장 비율 |
|---|---|---|
| 01-cover.jpg | 표지 실크 | 세로 2:3 |
| 02-standing.jpg | 전신 | 세로 2:3 |
| 03-portrait.jpg | 얼굴 | 세로 2:3 |
| 04-chiffon.jpg | 디테일 | 세로 2:3 |
| 05-seated.jpg | 좌식 | 세로 2:3 |
| 06-coat.jpg | 뒷모습 | 세로 2:3 |
| 07-still.jpg | 정물 | 가로 3:2 |
| 08-neck.jpg | 목선 | 세로 2:3 |

제목·설명은 `index.html`에서 `BLUSH`, `화보집` 글을 찾아 바꾸면 됩니다.

## 커스텀 도메인

Pages 설정에 `www.내주소.com`을 넣고, 도메인 DNS에 GitHub가 안내하는 A/CNAME만 연결하면 됩니다. GitHub Pages 자체는 무료입니다.
