// const cloudscraper = require('cloudscraper');
const got = require('@/utils/got');
const cheerio = require('cheerio');
const wait = require('@/utils/wait');
const logger = require('@/utils/logger');
const util = require('util');


module.exports = async (ctx) => {
    const {type} = ctx.params;
    const url = 'https://steamdb.info/upcoming/free/';
    // const html = await cloudscraper.get(url);
    const html = await got({
        method: 'get',
        url: url,
        http2: true,
    }).then(response => {
        return response.body;
    }).catch(error => {
        console.log(error.response.body);
    });
    logger.info(`Request ${url}`);
    const $ = cheerio.load(html);

    const $trs = $('.container table.table-products:first-of-type tbody tr');
    const getItems = $trs
        .toArray()
        .reverse()
        .map(async (el) => {
        // .map((el) => {
            const $el = $(el);
            const $tds = $el.children('td');

            // link & logo - 0
            const linkEl = $($tds.get(0)).find('a').get(0);
            const link = (linkEl && linkEl.attribs.href) || '';

            // appid
            const found = /app\/(\d+)/.exec(link);
            const appid = found ? found[1] : '';

            // title - 1
            const title = $($tds.get(1)).text().trim();

            // promotion type - 3
            const promoType = $($tds.get(3)).text().trim();

            // startDate - 4
            const startDate = $tds.get(4).attribs.title;

            // endDate - 5
            // const endDate = $tds.get(5).attribs.title;

            // ignore items without appid or not matched the type
            if (!appid || (type && type.toLowerCase() !== promoType.toLocaleLowerCase())) {
                return null;
            }
            const hoverLink = `https://steamdb.info/api/RenderAppHover/?appid=${appid}`;
            const description = await ctx.cache.tryGet(hoverLink, async () => {
                // const description = await cloudscraper.get(hoverLink);
                const description = await got({
                    method: 'get',
                    url: hoverLink,
                    http2: true,
                });
                // const msg = util.inspect(description, true);

                logger.info(`Request ${hoverLink}`);
                return description.data;
            });

            return {
                title: `[${promoType}] ${title}`,
                link,
                pubDate: new Date(startDate).toUTCString(),
                description:`${description}`,
            };
        });

    const item = await Promise.all(getItems);

    ctx.state.data = {
        title: 'Steam 免费游戏 [SteamDB]',
        link: url,
        item: item.filter((itm) => !!itm),
        allowEmpty: true,
    };
};
