FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
# Editorial extraction: Poppler for PDFs, Tesseract for scans/images, and
# unzip for DOCX/PPTX XML. Generation remains an explicit admin action.
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr unzip python3 python3-pip && rm -rf /var/lib/apt/lists/*
RUN pip3 install --no-cache-dir --target /opt/wicker-python xlrd==2.0.2
ENV PYTHONPATH=/opt/wicker-python
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run content:verify-precomputed
RUN npm run build
RUN npm prune --omit=dev
EXPOSE 4177
CMD ["node", "runner.mjs"]
