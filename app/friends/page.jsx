import friends from '../../friends';

export const metadata = {
  title: "Young's Toy Box | 友情链接",
};

export default function Page() {
  return (
    <div>
      <h1>友情链接</h1>
      <p>以下是 Young 的一些可爱的朋友们——</p>
      <div className="friends-list">
        {friends.map((friend, index) => (
          <div key={index} className="friend-card">
            <img src={friend.avatarUrl} alt={friend.title} className="friend-avatar" />
            <div className="friend-card-content">
              <h3>
                <a href={friend.link} target="_blank" rel="noopener noreferrer">
                  {friend.title}
                </a>
              </h3>
              <p>{friend.description}</p>
            </div>
          </div>
        ))}
      </div>
      <h2>添加友情链接</h2>
      <p>
        提交{' '}
        <a
          href="https://github.com/Wesley-Young/wesley-young.github.io/pulls"
          target="_blank"
          rel="noopener noreferrer"
        >
          Pull Request
        </a>{' '}
        至 Blog 根目录下的 <code>friends.js</code> 文件。
      </p>
      <p>
        需要提供站点标题、描述、头像 URL 和链接，同时注意 <b>保留 trailing comma</b>。
      </p>
      <h2>Blog 信息</h2>
      <table>
        <tbody>
          <tr>
            <td>站点标题</td>
            <td>Young's Toy Box</td>
          </tr>
          <tr>
            <td>站点描述</td>
            <td>玩具盒</td>
          </tr>
          <tr>
            <td>头像 URL</td>
            <td>https://avatars.githubusercontent.com/u/25684570?v=4</td>
          </tr>
          <tr>
            <td>链接</td>
            <td>https://wesley-young.github.io/</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
