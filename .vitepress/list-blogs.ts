import fs from 'node:fs';
import grayMatter from 'gray-matter';

export function listBlogs() {
    return fs.readdirSync('./blog')
        .filter((file) => file.endsWith('.md'))
        .map((file) => ({
            name: file,
            ctime: fs.statSync(`./blog/${file}`).ctime,
        }))
        .sort((a, b) => {
            return b.ctime.getTime() - a.ctime.getTime();
        })
        .map((file) => ({
            text: `(${file.ctime.getFullYear()}-${file.ctime.getMonth()+1}-${file.ctime.getDate()}) ` + (grayMatter(fs.readFileSync(`./blog/${file.name}`, 'utf-8')).data.title ?? file.name.replace('.md', '')),
            link: `/blog/${file.name.replace('.md', '')}`,
        }));
}