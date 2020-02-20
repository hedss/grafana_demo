FROM balenalib/intel-nuc-node:12

WORKDIR /usr/src/app

COPY package.json /usr/src/app/

RUN npm install --production \
    && npm cache clean --force \
    && rm -rf /tmp/*

COPY *.js /usr/src/app/

CMD ["npm", "start"]
