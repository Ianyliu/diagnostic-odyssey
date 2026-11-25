// Census TIGERweb ACS26 counties, data as of January 1, 2026. Fixture-only scope.
// https://tigerweb.geo.census.gov/tigerwebmain/Files/acs26/tigerweb_acs26_county_wv.html
const westVirginiaCountyNames = [
  "Barbour", "Berkeley", "Boone", "Braxton", "Brooke", "Cabell", "Calhoun", "Clay", "Doddridge",
  "Fayette", "Gilmer", "Grant", "Greenbrier", "Hampshire", "Hancock", "Hardy", "Harrison", "Jackson",
  "Jefferson", "Kanawha", "Lewis", "Lincoln", "Logan", "McDowell", "Marion", "Marshall", "Mason",
  "Mercer", "Mineral", "Mingo", "Monongalia", "Monroe", "Morgan", "Nicholas", "Ohio", "Pendleton",
  "Pleasants", "Pocahontas", "Preston", "Putnam", "Raleigh", "Randolph", "Ritchie", "Roane", "Summers",
  "Taylor", "Tucker", "Tyler", "Upshur", "Wayne", "Webster", "Wetzel", "Wirt", "Wood", "Wyoming"
];

export const westVirginiaCounties: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries(
  westVirginiaCountyNames.map((name, index) => [`54${String(index * 2 + 1).padStart(3, "0")}`, name])
));

// Phase F pins only the neighboring county exercised by its fixture, with no inferred service area.
// https://tigerweb.geo.census.gov/tigerwebmain/Files/acs26/tigerweb_acs26_county_ky.html
const externalCounties: Readonly<Record<string, string>> = Object.freeze({ "21019": "Boyd" });
export const stateNames: Readonly<Record<string, string>> = Object.freeze({
  "21": "Kentucky", "24": "Maryland", "39": "Ohio", "42": "Pennsylvania", "51": "Virginia", "54": "West Virginia"
});

export function countyName(fips: string): string | undefined {
  if (Object.hasOwn(westVirginiaCounties, fips)) return westVirginiaCounties[fips];
  return Object.hasOwn(externalCounties, fips) ? externalCounties[fips] : undefined;
}

export function resolveCounty(name: string, stateFips: string): string | undefined {
  const canonical = name.trim().normalize("NFC").replace(/\s+county$/i, "").toLowerCase();
  const counties = stateFips === "54" ? westVirginiaCounties : externalCounties;
  return Object.keys(counties).find(fips => fips.startsWith(stateFips) && counties[fips]?.toLowerCase() === canonical);
}
