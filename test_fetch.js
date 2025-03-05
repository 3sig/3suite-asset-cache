import dns from "node:dns"
dns.setDefaultResultOrder("ipv4first");
(async () => {
  console.log(await fetch('http://gk-sd-03:3000'))
})();
