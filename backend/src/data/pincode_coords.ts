// Centroids of Delhi NCR Pincodes for Haversine Calculations
export const PINCODE_COORDS: Record<string, { lat: number; lng: number }> = {
  // CENTRAL DELHI
  '110001': { lat: 28.6315, lng: 77.2167 }, // Connaught Place
  '110002': { lat: 28.6400, lng: 77.2400 }, // Darya Ganj / ITO
  '110003': { lat: 28.5983, lng: 77.2283 }, // Pragati Vihar
  '110005': { lat: 28.6508, lng: 77.1893 }, // Karol Bagh
  '110006': { lat: 28.6558, lng: 77.2275 }, // Chandni Chowk
  '110008': { lat: 28.6442, lng: 77.1678 }, // Patel Nagar
  '110011': { lat: 28.6083, lng: 77.2083 }, // Ashoka Road / Parliament
  '110021': { lat: 28.5917, lng: 77.1833 }, // Chanakyapuri
  '110049': { lat: 28.5667, lng: 77.2167 }, // Lajpat Nagar / Moolchand

  // EAST DELHI
  '110031': { lat: 28.6517, lng: 77.2717 }, // Geeta Colony
  '110051': { lat: 28.6600, lng: 77.2833 }, // Krishna Nagar
  '110091': { lat: 28.6000, lng: 77.3000 }, // Mayur Vihar I
  '110092': { lat: 28.6300, lng: 77.2917 }, // Laxmi Nagar
  '110096': { lat: 28.6017, lng: 77.3200 }, // Mayur Vihar III / Ghazipur

  // NORTH DELHI
  '110007': { lat: 28.6833, lng: 77.2167 }, // Kamla Nagar
  '110084': { lat: 28.7167, lng: 77.2167 }, // Burari / Jagatpur

  // NORTH EAST DELHI
  '110053': { lat: 28.6917, lng: 77.2667 }, // Bhajanpura
  '110054': { lat: 28.6750, lng: 77.2250 }, // Civil Lines
  '110093': { lat: 28.6983, lng: 77.3017 }, // Nand Nagri
  '110094': { lat: 28.7150, lng: 77.2750 }, // Gokalpuri

  // NORTH WEST DELHI
  '110009': { lat: 28.7028, lng: 77.2036 }, // Model Town
  '110033': { lat: 28.7250, lng: 77.1750 }, // Jahangirpuri
  '110034': { lat: 28.6917, lng: 77.1417 }, // Saraswati Vihar
  '110035': { lat: 28.6750, lng: 77.1583 }, // Keshav Puram
  '110042': { lat: 28.7500, lng: 77.1500 }, // Badli
  '110052': { lat: 28.6958, lng: 77.1850 }, // Ashok Vihar
  '110083': { lat: 28.6950, lng: 77.0650 }, // Mangolpuri
  '110085': { lat: 28.7083, lng: 77.1167 }, // Rohini Sec 5
  '110086': { lat: 28.7183, lng: 77.0667 }, // Sultanpuri
  '110088': { lat: 28.7167, lng: 77.1583 }, // Shalimar Bagh
  '110089': { lat: 28.7300, lng: 77.1250 }, // Rohini Sec 16

  // SHAHDARA
  '110032': { lat: 28.6717, lng: 77.2883 }, // Shahdara
  '110095': { lat: 28.6750, lng: 77.3167 }, // Vivek Vihar / Dilshad Garden

  // SOUTH DELHI
  '110017': { lat: 28.5333, lng: 77.2167 }, // Malviya Nagar / Saket
  '110048': { lat: 28.5417, lng: 77.2333 }, // Greater Kailash
  '110062': { lat: 28.5083, lng: 77.2417 }, // Sangam Vihar / Khanpur
  '110070': { lat: 28.5383, lng: 77.1550 }, // Vasant Kunj
  '110074': { lat: 28.5017, lng: 77.1833 }, // Chattarpur
  '110080': { lat: 28.4900, lng: 77.2500 }, // Sangam Vihar Extended

  // SOUTH EAST DELHI
  '110014': { lat: 28.5783, lng: 77.2483 }, // Jungpura
  '110019': { lat: 28.5383, lng: 77.2517 }, // Kalkaji / Nehru Place
  '110020': { lat: 28.5283, lng: 77.2717 }, // Okhla Phase 1
  '110024': { lat: 28.5683, lng: 77.2383 }, // Lajpat Nagar / Defence Colony
  '110025': { lat: 28.5600, lng: 77.2833 }, // Jamia Nagar / Zakir Nagar
  '110029': { lat: 28.5672, lng: 77.2100 }, // Ansari Nagar / AIIMS New Delhi
  '110044': { lat: 28.4950, lng: 77.2917 }, // Badarpur / Tughlakabad
  '110065': { lat: 28.5617, lng: 77.2550 }, // East of Kailash
  '110076': { lat: 28.5317, lng: 77.2983 }, // Sarita Vihar

  // SOUTH WEST DELHI
  '110010': { lat: 28.5917, lng: 77.1333 }, // Delhi Cantt
  '110030': { lat: 28.5167, lng: 77.1833 }, // Mehrauli
  '110037': { lat: 28.5561, lng: 77.0872 }, // IGI Airport / Mahipalpur
  '110045': { lat: 28.5917, lng: 77.0833 }, // Palam
  '110057': { lat: 28.5653, lng: 77.1583 }, // Vasant Vihar
  '110058': { lat: 28.6183, lng: 77.0833 }, // Janakpuri
  '110059': { lat: 28.6117, lng: 77.0383 }, // Uttam Nagar
  '110061': { lat: 28.5750, lng: 77.0817 }, // Dwarka Sec 6
  '110067': { lat: 28.5417, lng: 77.1667 }, // Munirka / JNU
  '110075': { lat: 28.5794, lng: 77.0425 }, // Dwarka Sec 10
  '110077': { lat: 28.5833, lng: 77.0500 }, // Dwarka Sec 12
  '110078': { lat: 28.6017, lng: 77.0333 }, // Dwarka Sec 15

  // WEST DELHI
  '110015': { lat: 28.6600, lng: 77.1367 }, // Kirti Nagar
  '110018': { lat: 28.6367, lng: 77.0917 }, // Tilak Nagar
  '110026': { lat: 28.6583, lng: 77.1250 }, // Punjabi Bagh
  '110027': { lat: 28.6500, lng: 77.1167 }, // Rajouri Garden
  '110063': { lat: 28.6717, lng: 77.1000 }, // Paschim Vihar
  '110064': { lat: 28.6317, lng: 77.1250 }, // Mayapuri

  // NOIDA / GREATER NOIDA
  '201301': { lat: 28.5800, lng: 77.3300 }, // Noida Sec 15/19/27
  '201303': { lat: 28.5617, lng: 77.3483 }, // Noida Sec 37/44
  '201304': { lat: 28.5700, lng: 77.3700 }, // Noida Sec 50/51
  '201305': { lat: 28.5300, lng: 77.4000 }, // Noida Sec 82
  '201306': { lat: 28.5100, lng: 77.4200 }, // Noida Sec 93/110
  '201307': { lat: 28.5500, lng: 77.3200 }, // Noida Sec 12/22
  '201308': { lat: 28.4682, lng: 77.5131 }, // Greater Noida Alpha 1
  '201310': { lat: 28.4500, lng: 77.5300 }, // Greater Noida Pari Chowk
  '201309': { lat: 28.5200, lng: 77.4900 }, // Greater Noida Sector 1
  '201318': { lat: 28.5000, lng: 77.5000 }, // Noida Sec 137/143
  '201313': { lat: 28.4700, lng: 77.4800 }, // Greater Noida Tech Zone

  // GHAZIABAD
  '201001': { lat: 28.6667, lng: 77.4333 }, // Ghaziabad City
  '201002': { lat: 28.6750, lng: 77.4583 }, // Kavi Nagar
  '201003': { lat: 28.6917, lng: 77.4333 }, // Raj Nagar
  '201005': { lat: 28.6750, lng: 77.4833 }, // Sanjay Nagar
  '201009': { lat: 28.6500, lng: 77.5167 }, // Govindpuram
  '201010': { lat: 28.6417, lng: 77.3833 }, // Indirapuram
  '201011': { lat: 28.6583, lng: 77.3750 }, // Vaishali
  '201012': { lat: 28.6667, lng: 77.3833 }, // Vasundhara
  '201014': { lat: 28.6250, lng: 77.3600 }, // Kaushambi

  // GURUGRAM
  '122001': { lat: 28.4595, lng: 77.0266 }, // Gurugram Sadar Bazar
  '122002': { lat: 28.4417, lng: 77.0817 }, // DLF Phase 1 / Sector 28
  '122003': { lat: 28.4283, lng: 77.0417 }, // Sector 45 / 46
  '122008': { lat: 28.4900, lng: 77.0900 }, // DLF Phase 3 / Cyber City
  '122011': { lat: 28.4950, lng: 77.0750 }, // Sector 14 / 15
  '122018': { lat: 28.4117, lng: 77.0417 }, // Sector 48 / Sohna Road
  '122051': { lat: 28.4200, lng: 76.9000 }, // Manesar
  '122009': { lat: 28.4717, lng: 77.0600 }, // Palam Vihar

  // FARIDABAD
  '121001': { lat: 28.4083, lng: 77.3083 }, // NIT Faridabad / Sec 16
  '121002': { lat: 28.4250, lng: 77.3167 }, // Sector 15 / 21
  '121003': { lat: 28.3917, lng: 77.3083 }, // Sector 22 / 24
  '121004': { lat: 28.4417, lng: 77.3250 }, // Sector 28 / 31
  '121005': { lat: 28.3417, lng: 77.3250 }, // Ballabhgarh
  '121006': { lat: 28.3833, lng: 77.3333 }, // Sector 7 / 9
  '121007': { lat: 28.4617, lng: 77.3333 }, // Sector 37 / 39
  '121008': { lat: 28.4500, lng: 77.3167 }, // Sector 45 / 46
};

// Fallback lookup: returns a coordinate offset relative to a base point
// if a pincode is not exactly mapped in the list.
export function getCoordinates(pincode: string): { lat: number; lng: number } {
  const code = String(pincode || '').trim().replace(/\s+/g, '');
  if (PINCODE_COORDS[code]) {
    return PINCODE_COORDS[code];
  }

  // Deterministic offset based on string hash to ensure stable distances across test runs
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
    hash |= 0;
  }
  const offsetLat = ((hash % 100) / 100 - 0.5) * 0.05;
  const offsetLng = (((hash >> 3) % 100) / 100 - 0.5) * 0.05;

  // If a neighbor shares the first 5 digits, center around its known coordinate
  const neighbor5 = Object.keys(PINCODE_COORDS).find(k => k.slice(0, 5) === code.slice(0, 5));
  if (neighbor5) {
    const base = PINCODE_COORDS[neighbor5];
    return { lat: base.lat + offsetLat * 0.2, lng: base.lng + offsetLng * 0.2 };
  }

  // If a neighbor shares the first 4 digits, center around its known coordinate
  const neighbor4 = Object.keys(PINCODE_COORDS).find(k => k.slice(0, 4) === code.slice(0, 4));
  if (neighbor4) {
    const base = PINCODE_COORDS[neighbor4];
    return { lat: base.lat + offsetLat * 0.5, lng: base.lng + offsetLng * 0.5 };
  }

  const prefix = code.slice(0, 3);
  if (prefix === '110') {
    return { lat: 28.6304 + offsetLat, lng: 77.2177 + offsetLng };
  } else if (code.startsWith('2013')) {
    return { lat: 28.5700 + offsetLat, lng: 77.3300 + offsetLng };
  } else if (code.startsWith('2010')) {
    return { lat: 28.6667 + offsetLat, lng: 77.4333 + offsetLng };
  } else if (prefix === '122') {
    return { lat: 28.4595 + offsetLat, lng: 77.0266 + offsetLng };
  } else if (prefix === '121') {
    return { lat: 28.4083 + offsetLat, lng: 77.3083 + offsetLng };
  }
  
  return { lat: 28.6139 + offsetLat, lng: 77.2090 + offsetLng };
}
