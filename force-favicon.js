(function () {
  const faviconUrl = "https://accounts.rekietalabs.com/MyLabsLogo.png";

  // Remove existing favicons
  document.querySelectorAll('link[rel~="icon"]').forEach(el => el.remove());

  // Create new favicon link
  const link = document.createElement("link");
  link.rel = "icon";
  link.href = faviconUrl;
  link.type = "image/jpeg";

  // Append it to the head
  document.head.appendChild(link);
})();
