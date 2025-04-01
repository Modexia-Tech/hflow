// Mobile menu toggle only
document.addEventListener("DOMContentLoaded", function () {
  const mobileMenuButton = document.querySelector(
    '[data-collapse-toggle="navbar-sticky"]'
  );
  const mobileMenu = document.getElementById("navbar-sticky");

  mobileMenuButton.addEventListener("click", function () {
    mobileMenu.classList.toggle("hidden");
  });

  // Smooth scrolling
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        window.scrollTo({
          top: target.offsetTop - 80,
          behavior: "smooth",
        });
      }
    });
  });
});
