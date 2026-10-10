(function () {
  const header = document.querySelector(".site-header");
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.querySelector(".site-nav");
  const yearEl = document.getElementById("year");
  const form = document.getElementById("contact-form");
  const formStatus = document.getElementById("form-status");
  const submitBtn = document.getElementById("submit-btn");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      const open = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", open ? "false" : "true");
      siteNav.classList.toggle("is-open", !open);
    });

    siteNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navToggle.setAttribute("aria-expanded", "false");
        siteNav.classList.remove("is-open");
      });
    });
  }

  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    formStatus.textContent = "";
    formStatus.className = "form-status";

    var name = form.name.value.trim();
    var email = form.email.value.trim();
    var company = form.company.value.trim();
    var projectType = (form.projectType && form.projectType.value) || "";
    var timeline = (form.timeline && form.timeline.value) || "";
    var budget = (form.budget && form.budget.value) || "";
    var message = form.message.value.trim();

    if (!name || !email || !message) {
      formStatus.textContent = "Please fill in all required fields.";
      formStatus.classList.add("is-error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    try {
      var res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          email: email,
          company: company,
          projectType: projectType,
          timeline: timeline,
          budget: budget,
          message: message,
        }),
      });

      var data = await res.json().catch(function () {
        return {};
      });

      if (res.ok && data.ok) {
        formStatus.textContent = data.message || "Message sent successfully.";
        formStatus.classList.add("is-success");
        form.reset();
      } else {
        formStatus.textContent =
          data.error || "Something went wrong. Please email alimentriai@gmail.com directly.";
        formStatus.classList.add("is-error");
      }
    } catch (err) {
      formStatus.textContent =
        "Network error. Please try again or email alimentriai@gmail.com.";
      formStatus.classList.add("is-error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Request discovery call";
    }
  });
})();
