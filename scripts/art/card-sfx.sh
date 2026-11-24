#!/bin/bash
# カードを出す音を、ElevenLabs で作った音から加工してゲームに入れる（2026-11-24、持ち主が聞き比べて決めた加工）
# 使い方: bash scripts/art/card-sfx.sh <C の元の音> <S の元の音>  → public/sfx/card.ogg と public/sfx/card-s.ogg
# **Starter（商用可）で作った音だけを入れること。Free の音は入れない。**
# C: 頭の無音を切り、半音4つ下げ（0.794倍）、細かい反射を重ねて響きを強めに足す（C案3）
# S: 頭の無音を切り、半音1つ上げ（1.0595倍）、C より長い響きを足す（S案3）
# どちらも最後の無音を切り、-18 LUFS にそろえる（ほかの効果音と同じ）
set -e
C="$1"; S="$2"; OUT=public/sfx
mkdir -p "$OUT"
TRIM="aformat=channel_layouts=mono,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.005"
TAIL="silenceremove=stop_periods=-1:stop_threshold=-55dB:stop_duration=0.2,loudnorm=I=-18:TP=-2"
ffmpeg -nostdin -loglevel error -y -i "$C" -af "$TRIM,aresample=44100,asetrate=44100*0.794,aresample=44100,apad=pad_dur=0.7,aecho=0.85:0.65:29|43|61|89|127|167|211|263:0.32|0.27|0.23|0.19|0.15|0.11|0.08|0.05,$TAIL" -c:a libvorbis -q:a 5 "$OUT/card.ogg"
ffmpeg -nostdin -loglevel error -y -i "$S" -af "$TRIM,aresample=44100,asetrate=44100*1.0595,aresample=44100,apad=pad_dur=0.8,aecho=0.85:0.6:31|47|67|97|137|181|233|293|359:0.36|0.31|0.27|0.23|0.19|0.15|0.11|0.08|0.05,$TAIL" -c:a libvorbis -q:a 5 "$OUT/card-s.ogg"
echo "$OUT/card.ogg $OUT/card-s.ogg"
