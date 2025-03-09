import { useState, useEffect, useCallback } from 'react'
import './App.css'

function App() {
  const [artwork, setArtwork] = useState(null);
  const [loading, setLoading] = useState(true);
  const [banList, setBanList] = useState([]);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]); // New state for history

  // Fetch a random artwork with useCallback to avoid stale closures
  const fetchRandomArtwork = useCallback(async (retryCount = 0) => {
    // Limit retries to prevent infinite loop
    if (retryCount > 5) {
      setError('Too many restrictions in ban list. Please remove some items and try again.');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // First get the total number of artworks
      const countResponse = await fetch('https://api.artic.edu/api/v1/artworks?limit=1');
      const countData = await countResponse.json();
      const totalArtworks = countData.pagination.total;
      
      // Generate a random page number
      const randomPage = Math.floor(Math.random() * (totalArtworks / 12)) + 1;
      
      // Get a page of results
      const pageResponse = await fetch(`https://api.artic.edu/api/v1/artworks?page=${randomPage}&limit=12&fields=id,title,artist_title,date_display,image_id,place_of_origin,medium_display,artist_id`);
      const pageData = await pageResponse.json();
      
      // Filter out artworks that match ban list criteria
      const filteredArtworks = pageData.data.filter(art => {
        // Skip entries without images
        if (!art.image_id) return false;
        
        // Check if any banned attribute matches
        return !banList.some(ban => {
          if (ban.type === 'artist' && art.artist_title === ban.value) return true;
          if (ban.type === 'origin' && art.place_of_origin === ban.value) return true;
          if (ban.type === 'medium' && art.medium_display === ban.value) return true;
          return false;
        });
      });
      
      if (filteredArtworks.length === 0) {
        // If no artworks match after filtering, try again with incremented retry count
        fetchRandomArtwork(retryCount + 1);
        return;
      }
      
      // Select a random artwork from the filtered list
      const randomIndex = Math.floor(Math.random() * filteredArtworks.length);
      const selectedArtwork = filteredArtworks[randomIndex];
      
      // Set the image URL using the IIIF API
      selectedArtwork.imageUrl = `https://www.artic.edu/iiif/2/${selectedArtwork.image_id}/full/843,/0/default.jpg`;
      
      setArtwork(selectedArtwork);
      setHistory(prevHistory => [...prevHistory, selectedArtwork]); // Update history
    } catch (err) {
      console.error('Error fetching artwork:', err);
      setError('Failed to fetch artwork. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [banList]);

  // Add an attribute to the ban list
  const addToBanList = (type, value) => {
    if (!value) return;
    
    // Check if already in ban list
    const alreadyBanned = banList.some(item => item.type === type && item.value === value);
    if (alreadyBanned) return;
    
    setBanList([...banList, { type, value }]);
  };

  // Remove from ban list
  const removeFromBanList = (type, value) => {
    setBanList(banList.filter(item => !(item.type === type && item.value === value)));
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchRandomArtwork();
  }, [fetchRandomArtwork]);

  return (
    <div className="container">
      <h1>Art Gallery</h1>
      <p>Discover random artwork from the Art Institute of Chicago</p>
      <p className="instruction">Click on any artwork attribute to ban it from future results</p>
      
      <div className="card">
        <button 
          onClick={() => fetchRandomArtwork()} 
          disabled={loading}
          className={loading ? 'loading' : ''}
        >
          {loading ? 'Loading...' : 'Show Me Another!'}
        </button>
      </div>
      
      {error && <div className="error">{error}</div>}
      
      {loading && !error && (
        <div className="loading-display">
          <div className="loading-spinner"></div>
          <p>Finding interesting art for you...</p>
        </div>
      )}
      
      {artwork && !loading && (
        <div className="artwork-display">
          <h2>{artwork.title || 'Untitled'}</h2>
          <div className="image-container">
            <img 
              src={artwork.imageUrl} 
              alt={artwork.title} 
              className="artwork-image" 
            />
          </div>
          
          <div className="artwork-info">
            <div className="info-row">
              <div className="info-label">Artist:</div>
              <div className="info-value">
                <span 
                  className="clickable-attribute"
                  onClick={() => artwork.artist_title && addToBanList('artist', artwork.artist_title)}
                  title={artwork.artist_title ? "Click to ban this artist" : ""}
                >
                  {artwork.artist_title || 'Unknown'}
                </span>
              </div>
            </div>
            
            <div className="info-row">
              <div className="info-label">Origin:</div>
              <div className="info-value">
                <span 
                  className="clickable-attribute"
                  onClick={() => artwork.place_of_origin && addToBanList('origin', artwork.place_of_origin)}
                  title={artwork.place_of_origin ? "Click to ban this origin" : ""}
                >
                  {artwork.place_of_origin || 'Unknown'}
                </span>
              </div>
            </div>
            
            <div className="info-row">
              <div className="info-label">Medium:</div>
              <div className="info-value">
                <span 
                  className="clickable-attribute"
                  onClick={() => artwork.medium_display && addToBanList('medium', artwork.medium_display)}
                  title={artwork.medium_display ? "Click to ban this medium" : ""}
                >
                  {artwork.medium_display || 'Unknown'}
                </span>
              </div>
            </div>
            
            <div className="info-row">
              <div className="info-label">Date:</div>
              <div className="info-value">{artwork.date_display || 'Unknown'}</div>
            </div>
          </div>
          
          <div className="artwork-footer">
            <a 
              href={`https://www.artic.edu/artworks/${artwork.id}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="view-more-link"
            >
              View at Art Institute of Chicago ↗
            </a>
          </div>
        </div>
      )}
      
      {banList.length > 0 && (
        <div className="ban-list">
          <h3>Banned Items</h3>
          {banList.length > 0 ? (
            <ul>
              {banList.map((item, index) => (
                <li key={index}>
                  <div className="ban-item-content">
                    <span className="ban-type">{item.type}:</span> 
                    <span className="ban-value">{item.value}</span>
                  </div>
                  <button 
                    className="remove-ban"
                    onClick={() => removeFromBanList(item.type, item.value)}
                    title="Remove from ban list"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No items banned yet. Click on any artwork attribute to ban it.</p>
          )}
          
          {banList.length > 0 && (
            <button 
              className="clear-all-btn"
              onClick={() => setBanList([])}
            >
              Clear All Bans
            </button>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="history-list">
          <h3>Previously Viewed Artworks</h3>
          <ul>
            {history.map((item, index) => (
              <li key={index}>
                <div className="history-item">
                  <img src={item.imageUrl} alt={item.title} className="history-image" />
                  <div className="history-info">
                    <div className="history-title">{item.title || 'Untitled'}</div>
                    <div className="history-artist">{item.artist_title || 'Unknown'}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default App