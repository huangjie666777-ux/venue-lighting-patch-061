<script lang="ts">
  import { CHANNEL_COUNT } from '../types';

  interface Props {
    outputs: number[];
    base: number[];
    takeover: boolean[];
  }
  let { outputs, base, takeover }: Props = $props();

  // 4 列 x 3 行灯位（俯视示意）
  const positions = Array.from({ length: CHANNEL_COUNT }, (_, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    return { x: 110 + col * 140, y: 90 + row * 130 };
  });

  const clamp = (v: number) => Math.min(100, Math.max(0, v));
</script>

<svg viewBox="0 0 640 400" class="stage" role="img" aria-label="舞台 12 盏灯实际输出">
  <rect x="0" y="0" width="640" height="400" rx="10" fill="#11131a" />
  <rect x="24" y="30" width="592" height="340" rx="8" fill="none" stroke="#2a2f3d" stroke-width="2" />
  <text x="320" y="392" text-anchor="middle" fill="#5b6272" font-size="12">舞台灯位示意 · 光晕表示实际输出（含总控/黑场）</text>
  {#each positions as pos, i (i)}
    {@const out = clamp(outputs[i] ?? 0)}
    {@const b = clamp(base[i] ?? 0)}
    <circle
      cx={pos.x}
      cy={pos.y}
      r={14 + (out / 100) * 46}
      fill={`rgba(255, 213, 128, ${0.05 + (out / 100) * 0.4})`}
    />
    <circle
      cx={pos.x}
      cy={pos.y}
      r="16"
      fill="none"
      stroke="#3a4153"
      stroke-width="3"
      stroke-dasharray={`${(b / 100) * 100.5} 100.5`}
      transform={`rotate(-90 ${pos.x} ${pos.y})`}
    />
    <circle
      cx={pos.x}
      cy={pos.y}
      r="11"
      fill={`rgb(${Math.round(60 + out * 1.6)}, ${Math.round(46 + out * 1.5)}, ${Math.round(40 + out * 0.5)})`}
      stroke={takeover[i] ? '#ff5d73' : '#8b93a7'}
      stroke-width="2"
    />
    <text x={pos.x} y={pos.y + 3.5} text-anchor="middle" font-size="10"
      fill={out > 45 ? '#20150a' : '#d7dcea'}>{i + 1}</text>
    {#if takeover[i]}
      <text x={pos.x + 14} y={pos.y - 12} font-size="11" fill="#ff5d73">手</text>
    {/if}
  {/each}
</svg>

<style>
  .stage {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 10px;
  }
</style>
