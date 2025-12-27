"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { searchHomeDepot } from './actions';  // ← import server action
import generateShortId from '@/utils/generateShortId';

export default function MaterialsPulse() {
  const { id: projectId } = useParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentSub, setCurrentSub] = useState<{ company: string } | null>(null);

  // Load sub profile for company
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Load sub company (from subcontractors collection)
        // Placeholder — replace with real load
        setCurrentSub({ company: 'SitePulse' }); // demo
      }
    });
    return unsub;
  }, []);

const handleSearch = async () => {
  if (!searchQuery.trim()) return;

  setLoading(true);
  try {
    const results = await searchHomeDepot(searchQuery);  // ← Server action call
    setSearchResults(results);
  } catch (err) {
    console.error(err);
    alert('Search failed — check server logs');
  }
  setLoading(false);
};

const addToCart = (product: any) => {
  const existing = cart.find(item => item.product.product_id === product.product_id);
  if (existing) {
    setCart(cart.map(item => 
      item.product.product_id === product.product_id 
        ? { ...item, quantity: item.quantity + 1 }
        : item
    ));
  } else {
    setCart([...cart, { product, quantity: 1 }]);
  }
};

    const handleOrder = async () => {
    if (cart.length === 0) {
        alert('Cart is empty');
        return;
    }

    try {
        await addDoc(collection(db, 'tickets'), {
        projectId,
        type: 'supply-run',
        shoppingList: cart.map(item => ({
            name: item.product.title,
            price: item.product.price,
            quantity: item.quantity,
            link: item.product.link
        })),
        company: currentSub?.company || 'Unknown Sub',
        status: 'unclaimed',
        createdAt: serverTimestamp(),
        shortId: generateShortId(7),
        });

        alert('Order submitted! Driver will shop and deliver.');
        setCart([]);
    } catch (err) {
        console.error(err);
        alert('Order failed');
    }
    };

  return (
    <div style={{ padding: '2rem', minHeight: '100vh', backgroundColor: '#111827', color: 'white' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '2rem' }}>
        MaterialsPulse
      </h1>

      {/* Search */}
      <div style={{ maxWidth: '800px', margin: '0 auto 2rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Search Home Depot (e.g., caulking, nails, PVC fittings)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{
              flex: 1,
              padding: '1rem',
              borderRadius: '0.75rem',
              backgroundColor: '#374151',
              color: 'white',
              border: 'none',
              fontSize: '1.2rem'
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              padding: '1rem 2rem',
              backgroundColor: '#3B82F6',
              borderRadius: '0.75rem',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Results + Cart */}
      <div style={{ display: 'flex', gap: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Results */}
        <div style={{ flex: 2 }}>
        {searchResults.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '1.5rem' }}>
            Search for materials to get started
        </p>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {searchResults.map((product) => (
        <div 
            key={product.product_id}
            style={{
            backgroundColor: '#1F2937',
            borderRadius: '1rem',
            padding: '1.5rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column'
            }}
        >
            {/* Image */}
            {product.thumbnails && product.thumbnails.length > 0 && product.thumbnails[0][0] ? (
            <img 
                src={product.thumbnails[0][3]}  // Use [0][3] for ~300px size (better for 200px height; adjust as needed)
                alt={product.title}
                style={{ 
                width: '100%', 
                height: '200px', 
                objectFit: 'contain', 
                borderRadius: '0.75rem', 
                marginBottom: '1rem',
                backgroundColor: '#374151'
                }}
                onError={(e) => {
                e.currentTarget.src = '/placeholder-tool.jpg'; // optional fallback image
                e.currentTarget.style.opacity = '0.5';
                }}
            />
            ) : (
            <div style={{
                width: '100%',
                height: '200px',
                backgroundColor: '#374151',
                borderRadius: '0.75rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9CA3AF'
            }}>
                No image
            </div>
            )}

            {/* Details */}
            <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                {product.title}
            </div>
            <div style={{ fontSize: '1rem', color: '#9CA3AF', marginBottom: '0.5rem' }}>
                {product.description || 'No description available'}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FBBF24', marginBottom: '1rem' }}>
                {product.price || 'Price not available'}
            </div>
            {product.rating && (
                <div style={{ fontSize: '1rem', color: '#EAB308', marginBottom: '1rem' }}>
                Rating: {product.rating} ({product.reviews || 0} reviews)
                </div>
            )}
            </div>

            <button onClick={() => addToCart(product)} style={{ width: '100%', padding: '1rem', backgroundColor: '#16A34A', color: 'white', borderRadius: '0.75rem' }}>
            Add to Cart
            </button>
        </div>
        ))}
        </div>
        )}
        </div>

        {/* Cart */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Cart ({cart.length})</h2>
        {cart.length === 0 ? (
        <p style={{ color: '#9CA3AF' }}>Empty</p>
        ) : (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {cart.map((item, i) => (
                <div key={i} style={{ backgroundColor: '#374151', padding: '1rem', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold' }}>{item.product.title}</div>
                    <div>${item.product.price}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button onClick={() => {
                    if (item.quantity > 1) {
                        const newCart = [...cart];
                        newCart[i].quantity -= 1;
                        setCart(newCart);
                    }
                    }}>-</button>
                    <span style={{ minWidth: '40px', textAlign: 'center' }}>{item.quantity}</span>
                    <button onClick={() => {
                    const newCart = [...cart];
                    newCart[i].quantity += 1;
                    setCart(newCart);
                    }}>+</button>
                    <button 
                    onClick={() => setCart(cart.filter((_, index) => index !== i))}
                    style={{ marginLeft: '1rem', color: '#EF4444' }}
                    >
                    Remove
                    </button>
                </div>
                </div>
            ))}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#FBBF24' }}>
            Total: ${cart.reduce((sum, item) => {
                let priceStr = item.product.price || '0';
                if (typeof priceStr === 'number') priceStr = priceStr.toString();
                if (typeof priceStr === 'string') priceStr = priceStr.replace('$', '').trim();
                const price = parseFloat(priceStr) || 0;
                return sum + price * item.quantity;
            }, 0).toFixed(2)}
            </div>
            <button
            onClick={handleOrder}
            style={{
                width: '100%',
                padding: '1.5rem',
                backgroundColor: '#F59E0B',
                color: 'white',
                borderRadius: '1rem',
                fontWeight: 'bold',
                fontSize: '1.5rem'
            }}
            >
            Submit Order
            </button>
        </>
        )}
        </div>
      </div>
    </div>
  );
}