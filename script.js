// Theme Switching
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  // Change icon
  document.getElementById('theme-toggle').textContent = theme === 'dark' ? '🌞' : '🌙';
}
function toggleTheme() {
  const curr = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(curr === 'light' ? 'dark' : 'light');
}
document.addEventListener("DOMContentLoaded", function() {
  // Theme
  const saved = localStorage.getItem('theme');
  setTheme(saved === 'dark' ? 'dark' : 'light');
  document.getElementById('theme-toggle').onclick = toggleTheme;

  // Modal logic
  const modal = document.getElementById('contact-modal');
  const btn = document.getElementById('contact-btn');
  const closeBtn = document.querySelector('.close-btn');
  const form = document.getElementById('contact-form');
  const successMsg = document.getElementById('form-success');
  const errorMsg = document.getElementById('form-error');
  if (btn) btn.onclick = () => { modal.style.display = 'flex'; };
  if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
  window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };

  if (form) {
    form.onsubmit = async function(e) {
      e.preventDefault();
      successMsg.style.display = "none";
      errorMsg.style.display = "none";
      const [name, email, message] = Array.from(form.elements).slice(0, 3).map(f => f.value.trim());
      try {
        // Post to Vercel serverless function
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({name, email, message})
        });
        if (!response.ok) throw new Error();
        successMsg.style.display = "block";
        setTimeout(() => {
          form.reset();
          successMsg.style.display = "none";
          modal.style.display = "none";
        }, 1200);
      } catch (err) {
        errorMsg.style.display = "block";
      }
    };
  }

  // Reveal animations
  function revealOnScroll() {
    document.querySelectorAll('.reveal').forEach(sec => {
      const rect = sec.getBoundingClientRect();
      if (rect.top < window.innerHeight - 60) {
        sec.classList.add('visible');
      }
    });
  }
  window.addEventListener('scroll', revealOnScroll);
  revealOnScroll();
});