import * as THREE from "three";

// Glareshield equipment in the EBACE 6X photograph. Selector values and lit keys are illustrative.
export const guidanceWidth = 1.6;
export const selectors = [-0.352, -0.176, 0, 0.176, 0.352];
let finish: THREE.MeshStandardMaterial | undefined;

export function guidanceFinish() {
  if (finish) return finish;
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 108;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#555c60";
  c.fillRect(0, 0, 1920, 108);
  c.textAlign = "center";
  c.textBaseline = "middle";
  const px = (z: number) => (z / guidanceWidth + 0.5) * canvas.width;
  const text = (z: number, y: number, label: string, size: number, color: string) => {
    c.fillStyle = color;
    c.font = `600 ${size}px monospace`;
    c.fillText(label, px(z), y);
  };
  for (const [i, z] of selectors.entries()) {
    const x = px(z);
    c.strokeStyle = "#929a9c";
    c.lineWidth = 1.6;
    c.strokeRect(x - 99, 5, 198, 98);
    c.fillStyle = "#111b1e";
    c.fillRect(x - 81, 19, 76, 30);
    text(z - 0.035, 34, ["200", "090", "4100", "0000", "090"][i], 22, "#ffbf76");
    text(z + 0.042, 29, ["SPD", "HDG", "ALT", "V/S", "CRS"][i], 16, "#ece6d6");
    text(z + 0.041, 80, ["FMS", "NAV", "AP", "FLC", "APPR"][i], 13, "#e7ece6");
    for (const dx of [-88, 88]) {
      c.fillStyle = "#202529";
      c.fillRect(x + dx - 3, 11, 6, 6);
      c.fillRect(x + dx - 3, 90, 6, 6);
    }
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = side * (0.477 + i * 0.057);
      c.fillStyle = "#20272b";
      c.fillRect(px(z) - 25, 40, 50, 43);
      text(z, 61, ["FD", "YD", "CAUT", "WARN"][i], 12, i === 3 ? "#f29177" : "#e3e7df");
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return (finish = new THREE.MeshStandardMaterial({ map, roughness: 0.78 }));
}
