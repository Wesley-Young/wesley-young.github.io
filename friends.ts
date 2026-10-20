export interface Friend {
  title: string;
  description?: string;
  avatarUrl: string;
  link: string;
}

const friends: Friend[] = [
  {
    title: "ErrOrO's Space",
    description: 'OrO?OrO!',
    avatarUrl: 'https://blog.erroro.moe/assets/avatar.jpg',
    link: 'https://blog.erroro.moe/',
  },
  {
    title: '校奥浆糊',
    avatarUrl: 'https://blog.xiaoaojianghu.fun/img/icon.jpeg',
    link: 'https://blog.xiaoaojianghu.fun/',
  },
  {
    title: '里世界',
    description: 'Welcome To The World Of Lee',
    avatarUrl: 'https://leenet.xyz/avatar.png',
    link: 'https://leenet.xyz',
  },
  {
    title: 'Cdm2883 的个人博客',
    description: '我的中文个人博客 =￣ω￣=',
    avatarUrl: 'https://q1.qlogo.cn/g?b=qq&nk=1759370644&s=140',
    link: 'https://blog.cdms.vip',
  },
  {
    title: 'KujoStar',
    description: '平泽唯的地下男友',
    avatarUrl: 'https://kujostar.github.io/assets/avatar.jpg',
    link: 'https://kujostar.github.io/',
  },
  {
    title: 'zdd14990',
    description: '家里蹲是绝对正义',
    avatarUrl: 'https://zdd14990.github.io/assets/avatar.jpg',
    link: 'https://zdd14990.github.io/',
  },
];

export default friends;
