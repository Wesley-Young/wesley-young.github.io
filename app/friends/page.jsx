import friends from '../../friends';

export default function Page() {
  return (
    <div>
      <h1>友情链接</h1>
      <p>以下是 Young 的一些可爱的朋友们——</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {friends.map((friend, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              backgroundColor: '#ffffff',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
              alignItems: 'center',
            }}
          >
            <img
              src={friend.avatarUrl}
              alt={friend.title}
              style={{
                marginTop: 0,
                marginBottom: 0,
                width: '64px',
                height: '64px',
                borderRadius: '32px',
                marginRight: '16px',
              }}
            />
            <div style={{ flexGrow: 1 }}>
              <h3 style={{ marginTop: 0 }}>
                <a href={friend.link} target="_blank" rel="noopener noreferrer">
                  {friend.title}
                </a>
              </h3>
              <p style={{ marginBottom: 0 }}>{friend.description}</p>
            </div>
          </div>
        ))}
      </div>
      <h2>添加友情链接</h2>
      <p>
        提交 Pull Request 至 Blog 根目录下的 <code>friends.js</code> 文件。
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
