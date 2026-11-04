export const enableDemoSession = (target) => target.addInitScript(() => {
  sessionStorage.setItem('carmela.demo.member.v2', '1');
});
