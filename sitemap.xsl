---
layout: xslt
title: Sitemap
---

<h1>Sitemap</h1>
<p>以下是本站的所有链接（总共<xsl:value-of select="count(sm:urlset/sm:url)" />条）：</p>
<ul>
  <xsl:for-each select="sm:urlset/sm:url">
    <li>
      <a>
        <xsl:attribute name="href"><xsl:value-of select="sm:loc" /></xsl:attribute>
        <xsl:value-of select="sm:loc" />
      </a>
    </li>
  </xsl:for-each>
</ul>