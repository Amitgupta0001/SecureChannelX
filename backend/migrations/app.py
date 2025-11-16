# gateway/app.py
from flask import Flask, request, jsonify, redirect
import requests
import jwt

app = Flask(__name__)

SERVICES = {
    'user': 'http://user-service:5001',
    'chat': 'http://chat-service:5002',
    'analytics': 'http://analytics-service:5003',
    'security': 'http://security-service:5004'
}

@app.before_request
def authenticate_and_route():
    # Skip authentication for health checks
    if request.path == '/health':
        return
    
    # Authenticate request
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({'error': 'Missing authorization header'}), 401
    
    try:
        token = auth_header.split(' ')[1]
        decoded = jwt.decode(token, options={"verify_signature": False})
        request.user_id = decoded['sub']
    except Exception as e:
        return jsonify({'error': 'Invalid token'}), 401
    
    # Route to appropriate service
    service = determine_service(request.path)
    if service:
        return proxy_request(service, request)
    else:
        return jsonify({'error': 'Service not found'}), 404

def determine_service(path):
    if path.startswith('/api/users'):
        return 'user'
    elif path.startswith('/api/messages') or path.startswith('/api/chat'):
        return 'chat'
    elif path.startswith('/api/analytics'):
        return 'analytics'
    elif path.startswith('/api/security'):
        return 'security'
    return None

def proxy_request(service, request):
    service_url = SERVICES[service]
    url = f"{service_url}{request.path}"
    
    headers = {key: value for key, value in request.headers if key != 'Host'}
    headers['X-User-ID'] = request.user_id
    
    try:
        response = requests.request(
            method=request.method,
            url=url,
            headers=headers,
            data=request.get_data(),
            params=request.args,
            cookies=request.cookies,
            allow_redirects=False
        )
        
        return (response.content, response.status_code, response.headers.items())
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Service unavailable: {service}'}), 503

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy', 'service': 'api-gateway'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)