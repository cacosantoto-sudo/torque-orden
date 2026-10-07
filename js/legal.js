// Datos del titular que aparecen en Términos y Condiciones y en la Política de privacidad.
// Completá estos valores (o pasáselos a Claude) antes de empezar a cobrar.
window.LEGAL = {
  version: "2026-10-07",            // fecha de la última versión de los textos
  titular: "[Nombre y apellido o razón social del titular]",
  cuit: "[CUIT]",
  domicilio: "[Domicilio legal]",
  email: "[Correo de contacto]",
  jurisdiccion: "[Ciudad y provincia]"
};
(function () {
  function llenar() {
    document.querySelectorAll("[data-legal]").forEach(function (el) {
      var v = window.LEGAL[el.getAttribute("data-legal")];
      if (v) el.textContent = v;
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", llenar); else llenar();
})();
