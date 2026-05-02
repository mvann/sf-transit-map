import { namedFlavor } from "@protomaps/basemaps";
import type { Flavor } from "@protomaps/basemaps";

export const oceanFlavor: Flavor = {
  ...namedFlavor("dark"),

  // Deep ocean base
  background: "#0a1628",
  earth: "#0d1b2a",
  water: "#06101f",

  // Land areas — dark navy tones
  park_a: "#0f2233",
  park_b: "#112838",
  hospital: "#121e2e",
  industrial: "#0e1a2a",
  school: "#121e2e",
  wood_a: "#0c1a29",
  wood_b: "#0d1c2b",
  pedestrian: "#101c2c",
  scrub_a: "#0d1a28",
  scrub_b: "#0e1b29",
  glacier: "#142535",
  sand: "#111d2d",
  beach: "#13243a",
  aerodrome: "#0e1a2a",
  runway: "#1a2d44",
  zoo: "#0f2030",
  military: "#0e1926",

  // Roads — subtle blue-grays
  tunnel_other_casing: "#081220",
  tunnel_minor_casing: "#081220",
  tunnel_link_casing: "#081220",
  tunnel_major_casing: "#081220",
  tunnel_highway_casing: "#081220",
  tunnel_other: "#142536",
  tunnel_minor: "#142536",
  tunnel_link: "#162a3e",
  tunnel_major: "#162a3e",
  tunnel_highway: "#1a3048",

  pier: "#1a2d44",
  buildings: "#081525",

  minor_service_casing: "#0a1628",
  minor_casing: "#0a1628",
  link_casing: "#0a1628",
  major_casing_late: "#0a1628",
  highway_casing_late: "#0b1829",
  major_casing_early: "#0a1628",
  highway_casing_early: "#0b1829",

  other: "#162a3e",
  minor_service: "#162a3e",
  minor_a: "#1a3048",
  minor_b: "#162a3e",
  link: "#1a3048",
  major: "#1e3650",
  highway: "#234060",
  railway: "#0a1830",

  boundaries: "#2a4a6b",

  // Bridges
  bridges_other_casing: "#0d1b2a",
  bridges_minor_casing: "#0d1b2a",
  bridges_link_casing: "#0d1b2a",
  bridges_major_casing: "#0d1b2a",
  bridges_highway_casing: "#0d1b2a",
  bridges_other: "#162a3e",
  bridges_minor: "#162a3e",
  bridges_link: "#1a3048",
  bridges_major: "#1e3650",
  bridges_highway: "#234060",

  // Labels — soft blue-white
  roads_label_minor: "#3a5a7a",
  roads_label_minor_halo: "#0a1628",
  roads_label_major: "#4a7090",
  roads_label_major_halo: "#0a1628",
  ocean_label: "#2a5080",
  subplace_label: "#3a6088",
  subplace_label_halo: "#0a1628",
  city_label: "#6a9abc",
  city_label_halo: "#0a1628",
  state_label: "#2a4a6b",
  state_label_halo: "#0a1628",
  country_label: "#4a7090",
  address_label: "#2a4a6b",
  address_label_halo: "#0a1628",

  landcover: {
    grassland: "rgba(12, 28, 38, 1)",
    barren: "rgba(14, 22, 34, 1)",
    urban_area: "rgba(12, 20, 32, 1)",
    farmland: "rgba(12, 26, 36, 1)",
    glacier: "rgba(18, 30, 45, 1)",
    scrub: "rgba(13, 24, 34, 1)",
    forest: "rgba(10, 26, 38, 1)",
  },
};
