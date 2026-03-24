/**
 * IEGF — Form submission handler
 * Posts all forms to /api/send-email.php
 */
(function () {
  'use strict';

  var API_URL = '/api/send-email.php';

  // Map each form to its type and field names
  var formConfigs = [
    { selector: '[data-form="contact"]',    type: 'contact',   fields: ['name', 'email', 'subject', 'message'] },
    { selector: '#register form',           type: 'register',  fields: ['name', 'email', 'type'] },
    { selector: '#partner form',            type: 'partner',   fields: ['organisation', 'contact', 'email'] },
    { selector: '#gic form',                type: 'gic',       fields: ['name', 'location', 'email'] },
    { selector: '[data-form="subscribe"]',  type: 'subscribe', fields: ['email'] },
    { selector: '[data-form="notify"]',     type: 'notify',    fields: ['email'] },
  ];

  function getFormFields(form, fieldNames) {
    var data = {};
    fieldNames.forEach(function (name) {
      var el = form.querySelector('[name="' + name + '"]');
      if (el) data[name] = el.value.trim();
    });
    return data;
  }

  function setButtonState(btn, loading) {
    if (loading) {
      btn.dataset.originalText = btn.textContent;
      btn.textContent = 'Sending…';
      btn.disabled = true;
      btn.classList.add('opacity-70', 'cursor-not-allowed');
    } else {
      btn.textContent = btn.dataset.originalText || btn.textContent;
      btn.disabled = false;
      btn.classList.remove('opacity-70', 'cursor-not-allowed');
    }
  }

  function showFeedback(form, success, message) {
    // Remove any existing feedback
    var existing = form.querySelector('.form-feedback');
    if (existing) existing.remove();

    var div = document.createElement('div');
    div.className = 'form-feedback mt-4 p-3 rounded-lg text-sm font-medium text-center ' +
      (success
        ? 'bg-green/10 text-green border border-green/30'
        : 'bg-red-50 text-red-600 border border-red-200');
    div.textContent = message;
    form.appendChild(div);

    if (success) {
      setTimeout(function () { div.remove(); }, 6000);
    }
  }

  function handleSubmit(form, formType, fieldNames) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var btn = form.querySelector('button[type="submit"]');
      var data = getFormFields(form, fieldNames);
      data.form_type = formType;

      // Basic validation — check required fields are not empty
      var empty = fieldNames.filter(function (f) { return !data[f]; });
      if (empty.length) {
        showFeedback(form, false, 'Please fill in all fields.');
        return;
      }

      setButtonState(btn, true);

      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
        .then(function (res) {
          setButtonState(btn, false);
          if (res.ok && res.body.success) {
            showFeedback(form, true, res.body.message || 'Sent successfully!');
            form.reset();
          } else {
            showFeedback(form, false, res.body.message || 'Something went wrong. Please try again.');
          }
        })
        .catch(function () {
          setButtonState(btn, false);
          showFeedback(form, false, 'Could not reach the server. Please try again later.');
        });
    });
  }

  // Bind forms on page load
  document.addEventListener('DOMContentLoaded', function () {
    formConfigs.forEach(function (cfg) {
      var form = document.querySelector(cfg.selector);
      if (form) handleSubmit(form, cfg.type, cfg.fields);
    });
  });
})();
