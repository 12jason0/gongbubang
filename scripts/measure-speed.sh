#!/usr/bin/env bash
# 운영 화면 응답 시간 재기 (화면마다 5번). 로그인 화면은 쿠키 없이, 나머지는 로그인 쿠키로.
#   GB_COOKIE='<브라우저 개발자도구 > Application > Cookies 의 gb_session 값>' bash scripts/measure-speed.sh
#   (쿠키는 비밀번호와 같으니 다른 데 붙여 넣지 말 것. 주소를 바꾸려면 BASE=https://... )
BASE="${BASE:-https://gongbubang-tau.vercel.app}"
for p in /login / /students /stats /dashboard; do
  printf "%-11s" "$p"
  for i in 1 2 3 4 5; do
    if [ "$p" = /login ]; then r=$(curl -s -o /dev/null -w '%{http_code} %{time_total}' "$BASE$p")
    else r=$(curl -s -o /dev/null -b "gb_session=$GB_COOKIE" -w '%{http_code} %{time_total}' "$BASE$p"); fi
    printf "%ss(%s) " "${r#* }" "${r%% *}"
  done
  echo
done
