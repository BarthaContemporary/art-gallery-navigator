
export const formatAddressForGeocoding = (rawAddress: string) => {
  return rawAddress
    .replace(/\r\n/g, ', ')
    .replace(/\n/g, ', ')
    .replace(/\r/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/, '')
    .trim();
};

export const openGoogleMaps = (address: string) => {
  if (address) {
    const formattedAddress = formatAddressForGeocoding(address);
    const encodedAddress = encodeURIComponent(formattedAddress);
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    window.open(googleMapsUrl, '_blank');
  }
};
