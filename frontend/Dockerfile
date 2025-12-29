# frontend.Dockerfile

# 阶段 1: 构建 (Build Stage)
FROM node:20-alpine as build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

# 阶段 2: 运行 (Production Stage)
FROM nginx:alpine
# 从上一阶段复制构建产物 dist 到 nginx 目录
COPY --from=build /app/dist /usr/share/nginx/html
# 复制自定义的 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]