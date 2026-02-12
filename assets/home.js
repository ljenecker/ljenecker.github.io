(() => {
  const menuBtn = document.getElementById("menuBtn");
  const mobileMenu = document.getElementById("mobileMenu");

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener("click", () => {
      mobileMenu.classList.toggle("hidden");
    });
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
    return;
  }

  const hasLibs = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  if (!hasLibs) return;

  gsap.registerPlugin(ScrollTrigger);

  if (typeof window.Lenis !== "undefined") {
    const lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.2,
    });

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  }

  gsap.utils.toArray("[data-reveal]").forEach((el, index) => {
    gsap.fromTo(
      el,
      { y: 22, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: 0.65,
        ease: "power3.out",
        delay: (index % 4) * 0.03,
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none reverse",
        },
      }
    );
  });

  gsap.to(".hero-section", {
    backgroundPosition: "50% 56%",
    ease: "none",
    scrollTrigger: {
      trigger: ".hero-section",
      start: "top top",
      end: "bottom top",
      scrub: 0.9,
    },
  });

  gsap.to(".hero-light", {
    yPercent: 16,
    xPercent: -10,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero-section",
      start: "top top",
      end: "bottom top",
      scrub: 1,
    },
  });

  const trustValues = gsap.utils.toArray(".trust-value[data-count]");
  if (trustValues.length) {
    ScrollTrigger.create({
      trigger: ".trust-strip",
      start: "top 82%",
      once: true,
      onEnter: () => {
        trustValues.forEach((el) => {
          const target = Number(el.getAttribute("data-count")) || 0;
          const suffix = el.getAttribute("data-suffix") || "";
          const tweenState = { value: 0 };

          gsap.to(tweenState, {
            value: target,
            duration: 1.1,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = `${Math.round(tweenState.value).toLocaleString()}${suffix}`;
            },
          });
        });
      },
    });
  }
})();
