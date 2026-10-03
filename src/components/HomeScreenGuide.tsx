import { EllipsisVertical, Share, Smartphone } from 'lucide-react';

export default function HomeScreenGuide() {
  return <section className="home-screen-guide" aria-labelledby="home-screen-title">
    <div className="home-screen-heading"><Smartphone size={20} aria-hidden="true"/><div><h2 id="home-screen-title">添加到主屏幕</h2><p>把班务看板放到手机桌面，下次点图标即可打开。</p></div></div>
    <div className="home-screen-options">
      <details open>
        <summary>iPhone / iPad · Safari</summary>
        <ol>
          <li>用 <strong>Safari 浏览器</strong>打开本站。</li>
          <li>点<Share size={16} aria-hidden="true"/><strong>“共享”</strong>（方框向上箭头）；若未显示，先点“更多”再选“共享”。</li>
          <li>向下滑动菜单，选<strong>“添加到主屏幕”</strong>。如有<strong>“作为网页 App 打开”</strong>，保持开启，再点<strong>“添加”</strong>。</li>
        </ol>
        <p className="home-screen-tip">找不到“添加到主屏幕”？滑到共享菜单底部，点“编辑操作”添加该选项。</p>
        <a href="https://support.apple.com/zh-cn/guide/iphone/iphea86e5236/26/ios/26" target="_blank" rel="noreferrer">查看 Apple 官方说明</a>
      </details>
      <details>
        <summary>Android · Chrome</summary>
        <ol>
          <li>用 <strong>Chrome 浏览器</strong>打开本站。</li>
          <li>点地址栏旁的<EllipsisVertical size={16} aria-hidden="true"/><strong>三点菜单</strong>，选<strong>“安装并创建快捷方式”</strong>。</li>
          <li>选择<strong>“安装”</strong>或<strong>“创建快捷方式”</strong>，按屏幕提示确认添加。</li>
        </ol>
        <p className="home-screen-tip">旧版 Chrome 可能显示“添加到主屏幕”或“安装应用”。其他 Android 浏览器的菜单名称可能不同，可先用 Chrome 打开本站。</p>
        <a href="https://support.google.com/chrome/answer/15085120?co=GENIE.Platform%3DAndroid&hl=zh-Hans" target="_blank" rel="noreferrer">查看 Chrome 官方说明</a>
      </details>
    </div>
    <p className="home-screen-note">在微信或 QQ 中打开的页面，请先从菜单选择“在浏览器中打开”，再按上方步骤操作。</p>
  </section>;
}
