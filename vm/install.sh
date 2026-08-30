curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
sudo apt-get install -y iptables-persistent
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
sudo iptables -I INPUT -p tcp -m tcp --dport 5000 -j ACCEPT
sudo iptables -I INPUT -p tcp -m tcp --dport 3001 -j ACCEPT
sudo iptables -I INPUT -p tcp -m tcp --dport 80 -j ACCEPT
sudo netfilter-persistent save
