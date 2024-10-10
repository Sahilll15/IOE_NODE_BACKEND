const axios = require('axios');
const mongoose = require('mongoose');


mongoose.connect('mongodb://localhost:27017/newsdb', { useNewUrlParser: true, useUnifiedTopology: true });

const newsSchema = new mongoose.Schema({
  article_id: String,
  title: String,
  link: String,
  keywords: [String],
  creator: [String],
  video_url: String,
  description: String,
  content: String,
  pubDate: Date,
  pubDateTZ: String,
  image_url: String,
  source_id: String,
  source_priority: Number,
  source_name: String,
  source_url: String,
  source_icon: String,
  language: String,
  country: [String],
  category: [String],
  ai_tag: String,
  sentiment: String,
  sentiment_stats: Object,
  ai_region: String,
  ai_org: String,
  duplicate: Boolean
}, { timestamps: true });

const News = mongoose.model('News', newsSchema);

let config = {
  method: 'get',
  maxBodyLength: Infinity,
  url: 'https://newsdata.io/api/1/latest?apikey=pub_5547393d6b74446c2649e620e43c2de0eb8e8',
  headers: { }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchAndSaveNews = async () => {
  for(let i = 0; i < 100; i++) {
    try {
      const response = await axios.request(config);
      const newsData = response.data.results;
      
      for (let item of newsData) {
        const news = new News({
          article_id: item.article_id,
          title: item.title,
          link: item.link,
          keywords: item.keywords,
          creator: item.creator,
          video_url: item.video_url,
          description: item.description,
          content: item.content,
          pubDate: new Date(item.pubDate),
          pubDateTZ: item.pubDateTZ,
          image_url: item.image_url,
          source_id: item.source_id,
          source_priority: item.source_priority,
          source_name: item.source_name,
          source_url: item.source_url,
          source_icon: item.source_icon,
          language: item.language,
          country: item.country,
          category: item.category,
          ai_tag: item.ai_tag,
          sentiment: item.sentiment,
          sentiment_stats: item.sentiment_stats,
          ai_region: item.ai_region,
          ai_org: item.ai_org,
          duplicate: item.duplicate
        });
        
        await news.save();
      }
      
      console.log(`Iteration ${i + 1}: News data saved to database successfully`);
      
      // Add a delay of 5 seconds between requests
      await delay(60000);
    } catch (error) {
      console.error(`Error in iteration ${i + 1}:`, error);
    }
  }
};

fetchAndSaveNews();