import { useState, useEffect } from 'react';
import axios from 'axios';

function Admin() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const API_BASE_URL = 'http://192.168.0.104:5000';

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/orders`);
      setOrders(res.data);
    } catch (error) {
      console.log(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (jobId, status) => {
    try {
      await axios.post(`${API_BASE_URL}/api/admin/orders/${jobId}/status`, { status });
      fetchOrders();
    } catch (error) {
      alert('Status update failed');
    }
  };

  const getStatusColor = (status) => {
    if (status === 'done') return '#d4edda';
    if (status === 'printing') return '#fff3cd';
    return '#f8d7da';
  };

  if (loading) return <h2 style={{textAlign: 'center'}}>Loading Orders...</h2>;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Falguni Xerox - Admin Panel</h1>
      <button onClick={fetchOrders} style={{marginBottom: '20px', padding: '8px 16px'}}>Refresh</button>

      {orders.length === 0? (
        <p>No orders found</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
          <thead>
            <tr style={{ background: '#0a8f08', color: 'white' }}>
              <th style={{padding: '12px', border: '1px solid #ddd'}}>Token</th>
              <th style={{padding: '12px', border: '1px solid #ddd'}}>Pages</th>
              <th style={{padding: '12px', border: '1px solid #ddd'}}>Copies</th>
              <th style={{padding: '12px', border: '1px solid #ddd'}}>Type</th>
              <th style={{padding: '12px', border: '1px solid #ddd'}}>Price</th>
              <th style={{padding: '12px', border: '1px solid #ddd'}}>Payment</th>
              <th style={{padding: '12px', border: '1px solid #ddd'}}>Status</th>
              <th style={{padding: '12px', border: '1px solid #ddd'}}>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.jobId} style={{ background: getStatusColor(order.status) }}>
                <td style={{padding: '12px', border: '1px solid #ddd', fontWeight: 'bold'}}>#{order.token || 'Online'}</td>
                <td style={{padding: '12px', border: '1px solid #ddd'}}>{order.pages}</td>
                <td style={{padding: '12px', border: '1px solid #ddd'}}>{order.copies}</td>
                <td style={{padding: '12px', border: '1px solid #ddd'}}>{order.printType}</td>
                <td style={{padding: '12px', border: '1px solid #ddd'}}>₹{order.price}</td>
                <td style={{padding: '12px', border: '1px solid #ddd'}}>{order.payment?.method || 'cash'}</td>
                <td style={{padding: '12px', border: '1px solid #ddd', fontWeight: 'bold'}}>{order.status?.toUpperCase()}</td>
                <td style={{padding: '12px', border: '1px solid #ddd'}}>
                  {order.status === 'paid' || order.status === 'cash'? (
                    <button onClick={() => updateStatus(order.jobId, 'printing')} style={{background: '#ff9800', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer'}}>
                      Start Printing
                    </button>
                  ) : order.status === 'printing'? (
                    <button onClick={() => updateStatus(order.jobId, 'done')} style={{background: '#0a8f08', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer'}}>
                      Mark Done
                    </button>
                  ) : (
                    <span>Completed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Admin;
