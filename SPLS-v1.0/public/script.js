function expandSignup() {
  document.getElementById("signupCollapsed").style.display = "none";
  document.getElementById("signupForm").style.display = "block";
}

function signup() {
  const data = {
    firstName: document.getElementById("firstName").value,
    lastName: document.getElementById("lastName").value,
    mobile: document.getElementById("mobile").value,
    email: document.getElementById("email").value,
    company: document.getElementById("company").value,
    password: document.getElementById("password").value,
    confirm: document.getElementById("confirm").value,
  };

  if (data.password !== data.confirm) {
    alert("Passwords do not match.");
    return;
  }

  fetch("/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(res => res.json()).then(res => {
    if (res.success) {
      alert("Signup successful. Please log in.");
      document.querySelectorAll(".signup-box input").forEach(el => el.value = "");
    } else {
      alert("Signup failed.");
    }
  });
}

function login() {
  const mobile = document.getElementById("loginMobile").value;
  const password = document.getElementById("loginPassword").value;

  fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile, password }),
  }).then(res => res.json()).then(res => {
    if (res.success) {
      sessionStorage.setItem("user", mobile);
      window.location.href = "dashboard.html";
    } else {
      alert(res.message);
    }
  });
}


