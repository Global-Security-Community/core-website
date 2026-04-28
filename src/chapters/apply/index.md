---
layout: base.njk
title: Apply to Lead a Chapter
description: "Apply to lead a Global Security Community chapter in your city. We provide resources, guidance, and support."
---

<div class="container">
  <h1>Apply to Lead a Chapter</h1>

  <p>Passionate about building a security community in your city? We'd love to hear from you. Fill out the form below and our team will review your application.</p>

  <div class="narrow-content">
    <div id="form-message" role="alert" class="form-message is-hidden"></div>
    <form id="chapter-apply-form">
      <h2 class="mt-0">Primary Chapter Lead</h2>

      <div class="form-group">
        <label for="fullName">Full Name *</label>
        <input type="text" id="fullName" name="fullName" required aria-required="true" maxlength="100">
      </div>

      <div class="form-group">
        <label for="email">Email *</label>
        <small class="help-text-block" id="email-help">This must be the email address you use to log in to the Global Security Community website.</small>
        <input type="email" id="email" name="email" required aria-required="true" aria-describedby="email-help">
      </div>

      <div class="form-group">
        <label for="linkedIn">LinkedIn Profile URL</label>
        <input type="url" id="linkedIn" name="linkedIn" placeholder="https://linkedin.com/in/yourprofile">
      </div>

      <div class="form-group">
        <label for="github">GitHub Profile URL</label>
        <input type="url" id="github" name="github" placeholder="https://github.com/yourprofile">
      </div>

      <h2>Second Chapter Lead <span class="help-text">(Optional)</span></h2>

      <div class="form-group">
        <label for="secondLeadName">Full Name</label>
        <input type="text" id="secondLeadName" name="secondLeadName" maxlength="100">
      </div>

      <div class="form-group">
        <label for="secondLeadEmail">Email</label>
        <small class="help-text-block" id="secondLeadEmail-help">Must match the email they use to log in to the website.</small>
        <input type="email" id="secondLeadEmail" name="secondLeadEmail" aria-describedby="secondLeadEmail-help">
      </div>

      <div class="form-group">
        <label for="secondLeadLinkedIn">LinkedIn Profile URL</label>
        <input type="url" id="secondLeadLinkedIn" name="secondLeadLinkedIn" placeholder="https://linkedin.com/in/yourprofile">
      </div>

      <div class="form-group">
        <label for="secondLeadGitHub">GitHub Profile URL</label>
        <input type="url" id="secondLeadGitHub" name="secondLeadGitHub" placeholder="https://github.com/yourprofile">
      </div>

      <h2>Chapter Details</h2>

      <div class="form-group">
        <label for="city">City *</label>
        <input type="text" id="city" name="city" required aria-required="true" maxlength="100" placeholder="e.g. Perth, London, New York">
      </div>

      <div class="form-group">
        <label for="country">Country *</label>
        <select id="country" name="country" required aria-required="true">
          <option value="">Select your country</option>
          <option value="Afghanistan">Afghanistan</option>
          <option value="Albania">Albania</option>
          <option value="Algeria">Algeria</option>
          <option value="Argentina">Argentina</option>
          <option value="Australia">Australia</option>
          <option value="Austria">Austria</option>
          <option value="Bangladesh">Bangladesh</option>
          <option value="Belgium">Belgium</option>
          <option value="Brazil">Brazil</option>
          <option value="Canada">Canada</option>
          <option value="Chile">Chile</option>
          <option value="China">China</option>
          <option value="Colombia">Colombia</option>
          <option value="Croatia">Croatia</option>
          <option value="Czech Republic">Czech Republic</option>
          <option value="Denmark">Denmark</option>
          <option value="Egypt">Egypt</option>
          <option value="Estonia">Estonia</option>
          <option value="Finland">Finland</option>
          <option value="France">France</option>
          <option value="Germany">Germany</option>
          <option value="Ghana">Ghana</option>
          <option value="Greece">Greece</option>
          <option value="Hong Kong">Hong Kong</option>
          <option value="Hungary">Hungary</option>
          <option value="Iceland">Iceland</option>
          <option value="India">India</option>
          <option value="Indonesia">Indonesia</option>
          <option value="Ireland">Ireland</option>
          <option value="Israel">Israel</option>
          <option value="Italy">Italy</option>
          <option value="Japan">Japan</option>
          <option value="Kenya">Kenya</option>
          <option value="Latvia">Latvia</option>
          <option value="Lithuania">Lithuania</option>
          <option value="Luxembourg">Luxembourg</option>
          <option value="Malaysia">Malaysia</option>
          <option value="Mexico">Mexico</option>
          <option value="Morocco">Morocco</option>
          <option value="Netherlands">Netherlands</option>
          <option value="New Zealand">New Zealand</option>
          <option value="Nigeria">Nigeria</option>
          <option value="Norway">Norway</option>
          <option value="Pakistan">Pakistan</option>
          <option value="Peru">Peru</option>
          <option value="Philippines">Philippines</option>
          <option value="Poland">Poland</option>
          <option value="Portugal">Portugal</option>
          <option value="Romania">Romania</option>
          <option value="Saudi Arabia">Saudi Arabia</option>
          <option value="Serbia">Serbia</option>
          <option value="Singapore">Singapore</option>
          <option value="Slovakia">Slovakia</option>
          <option value="Slovenia">Slovenia</option>
          <option value="South Africa">South Africa</option>
          <option value="South Korea">South Korea</option>
          <option value="Spain">Spain</option>
          <option value="Sri Lanka">Sri Lanka</option>
          <option value="Sweden">Sweden</option>
          <option value="Switzerland">Switzerland</option>
          <option value="Taiwan">Taiwan</option>
          <option value="Thailand">Thailand</option>
          <option value="Turkey">Turkey</option>
          <option value="Uganda">Uganda</option>
          <option value="Ukraine">Ukraine</option>
          <option value="United Arab Emirates">United Arab Emirates</option>
          <option value="United Kingdom">United Kingdom</option>
          <option value="United States">United States</option>
          <option value="Vietnam">Vietnam</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div class="form-group">
        <label for="whyLead">Why Do You Want to Lead a Chapter? * <span class="char-hint">(max 500 characters)</span></label>
        <textarea id="whyLead" name="whyLead" rows="4" required aria-required="true" maxlength="500" placeholder="What motivates you to start a security community in your city?"></textarea>
        <span class="char-count" data-for="whyLead">0 / 500</span>
      </div>

      <div class="form-group">
        <label for="existingCommunity">Do You Have an Existing Community? <span class="char-hint">(max 300 characters)</span></label>
        <textarea id="existingCommunity" name="existingCommunity" rows="3" maxlength="300" placeholder="If you already run a meetup group, Discord server, or similar community, tell us about it."></textarea>
        <span class="char-count" data-for="existingCommunity">0 / 300</span>
      </div>

      <div class="form-group">
        <div class="cf-turnstile" data-sitekey="{{ turnstileSiteKey }}" data-theme="light"></div>
      </div>

      <button type="submit">Submit Application</button>
    </form>
  </div>

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script src="/js/chapter-apply-form.js?v={{ cacheBust }}"></script>
</div>
