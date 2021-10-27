const axios = require('axios');
const iconv = require('iconv-lite');
const cheerio = require('cheerio');
const async = require('async');
const fs = require('fs');

// 首页链接
const HOST = 'http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/2020/';
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.119 Safari/537.36' };
const filePath = {
  province: 'src/province.json',
  city: 'src/city.json',
  country: 'src/country.json'
}

function joinUrl (url) {
  return HOST + url;
  // if (url2.startsWith('/')) {
  //   url2 = url2.slice(1, url2.length)
  // }
  // if (url1.endsWith('/')) {
  //   return url1 + url2;
  // } else {
  //   return url1.replace('index.html', url2)
  //   // return url1 + '/' + url2;
  //   // return url1
  // }
};

// 省份数据
const proviceStr = (html) => {
  const $ = cheerio.load(html)
  let result = [];
  $(".provincetr a").each(function (index, element) {
    let name = $(element).text().trim();
    let url = $(element).attr("href");
    let id = url.replace('.html', '');
    result.push({
      pid: '',
      id,
      name,
      url: joinUrl(url),
    })
  });
  return result;
};

// 市级数据
const cityStr = (html, purl, pid, type) => {
  const typeStr = { 'city': 'citytr', 'country': 'countytr', 'town': 'towntr' };
  const $ = cheerio.load(html);
  let result = [];
  $(`tr.${typeStr[type]}`).each(function (index, element) {
    let td0 = null;
    let td1 = null;
    let url = '';
    if ($(this).find("a").length == 0) {
      td0 = $(this).find("td").first();
      td1 = $(this).find("td").last();
    } else {
      td0 = $(this).find("a").first();
      td1 = $(this).find("a").last();
    }
    let id = td0.text();
    let name = td1.text();
    if (td0.attr("href") || td1.attr("href")) {
      url = joinUrl(td0.attr("href") || td1.attr("href"));
    };
    result.push({
      pid,
      id,
      name,
      url
    })
  })
  return result;
};

// 请求数据
const fetchData = async (url, level, pid) => {
  // 配置 axios 直接拿 buffer 数据
  // 因为axios会将请求数据转换为utf-8格式
  let data = null;
  if (fs.existsSync(filePath[level])) {
    data = JSON.parse(fs.readFileSync(filePath[level]).toString())
    return data;
  } else {
    const res = await axios(url, { responseType: 'arraybuffer', headers });
    // iconv-lite 解析buffer数据为gb2312
    data = iconv.decode(res.data, 'gb2312');
  }

  switch (level) {
    case 'province':
      return proviceStr(data);
    case 'city':
      return cityStr(data, url, pid, level);
    case 'country':
      return cityStr(data, url, pid, level);
    case 'town':
      return cityStr(data, url, pid, level);
    default:
      return proviceStr(data);
  }
};
// 
// async函数返回的是一个Promise，所以map返回的是Promise数组。
// 等到所有Promise得到处理之后再进行赋值操作
const asyncFetch = async (data, level) => {
  if (fs.existsSync(filePath[level])) {
    const fileData = JSON.parse(fs.readFileSync(filePath[level]).toString())
    return fileData;
  }
  let records = []
  // await Promise.all(data.map(async item => {
  //   const dits = await fetchData(item.url, level, item.id);
  //   records = records.concat(dits)
  // }));
  const alldata = await async.mapLimit(data, 7, async item => {
    const dits = await fetchData(item.url, level, item.id);
    records = records.concat(dits)
    return records;
  })
  return records;
};
// 主入口
const main = async () => {
  console.log('省级...');
  // 省级
  const Index = joinUrl('index.html');
  const provinceData = await fetchData(Index, 'province', '');
  fs.writeFileSync(filePath.province, JSON.stringify(provinceData));
  // 市级
  console.log('市级...');
  const cityData = await asyncFetch(provinceData, 'city');
  fs.writeFileSync(filePath.city, JSON.stringify(cityData));
  // 区县级
  console.log('区县级...');
  const countryData = await asyncFetch(cityData, 'country');
  fs.writeFileSync(filePath.country, JSON.stringify(countryData));
  console.log('done')
}

main();
