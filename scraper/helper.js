export function convertPostId(post_id) {
  const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

  let id = "";
  // Weibo encodes the ID in chunks of 4 characters from right to left
  for (let i = post_id.length - 4; i > -4; i -= 4) {
    let offset = i < 0 ? 0 : i;
    let len = i < 0 ? post_id.length % 4 : 4;
    let part = post_id.substring(offset, offset + len);
    
    let chunk = 0n;
    for (let char of part) {
      chunk = chunk * 62n + BigInt(ALPHABET.indexOf(char));
    }
    
    let chunkStr = chunk.toString();
    // Pad with zeros if it's not the first chunk
    if (offset > 0) {
      chunkStr = chunkStr.padStart(7, "0");
    }
    id = chunkStr + id;
  }
  return id;
}



export const formatComments = (comments) => {
  let rows = [];

  comments.forEach(c => {
    // 1) Primary comment
    rows.push({
      posted_time: new Date(c.created_at), // Converts Weibo string to JS Date
      comment: c.text_raw,
      like_count: c.like_counts || 0,
      comment_type: "primary",
      //Heated: 1 ~ 100
    });

    // 2) Secondary comments
    const children = c.comments;
    if (Array.isArray(children) && children.length > 0) {
      children.forEach(cc => {
        rows.push({
          posted_time: new Date(cc.created_at),
          comment: cc.text_raw,
          like_count: cc.like_counts || 0,
          comment_type: "secondary",
        });
      });
    }
  });

  // Sort by date (descending) - equivalent to sort_values in Pandas
  return rows //.sort((a, b) => b.posted_time - a.posted_time); 
};



export const getDuplicateSummary = (data) => {
  // 1. Create a frequency map
  const summaryMap = new Map();

  data.forEach(item => {
    const text = item.comment || "";
    if (summaryMap.has(text)) {
      const current = summaryMap.get(text);
      summaryMap.set(text, { 
        ...current, 
        freq: current.freq + 1,
        like_count: current.like_count + item.like_count
      });
    } else {
      summaryMap.set(text, { 
        comment: text, 
        freq: 1, 
        like_count: item.like_count,
        sentiment: "Loading...",
        confidence: "Loading..."
      });
    }
  });

  // 2. sort descending   //Sort by heated instead
  return Array.from(summaryMap.values()).sort((a, b) => {
    if (b.freq !== a.freq) { return b.freq - a.freq; } // Primary: Freq Descending 
    return b.like_count - a.like_count; // Tie-breaker: Likes Descending
  }
)};
