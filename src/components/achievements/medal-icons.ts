import { createLucideIcon, type IconNode } from "lucide-react";

/** Lucide's medal without the "1" it has on the disc. */
const RIBBON_AND_DISC: IconNode = [
  ["path", { d: "M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15", key: "ribbon" }],
  ["path", { d: "M11 12 5.12 2.2", key: "strap-l" }],
  ["path", { d: "m13 12 5.88-9.8", key: "strap-r" }],
  ["path", { d: "M8 7h8", key: "bar" }],
  ["circle", { cx: "12", cy: "17", r: "5", key: "disc" }],
];

/** A medal with nothing on it, for categories like sports. */
export const PlainMedal = createLucideIcon("plain-medal", RIBBON_AND_DISC);

/** Second place: a 2 on the disc. */
export const SecondMedal = createLucideIcon("second-medal", [
  ...RIBBON_AND_DISC,
  ["path", { d: "M10.6 15.8a1.4 1.4 0 0 1 2.8 0c0 1.1-2.8 1.9-2.8 3.2h2.8", key: "two" }],
]);

/** Third place: a 3 on the disc. */
export const ThirdMedal = createLucideIcon("third-medal", [
  ...RIBBON_AND_DISC,
  ["path", { d: "M10.7 15.1h2.6l-1.4 1.7a1.3 1.3 0 1 1-1.2 1.8", key: "three" }],
]);
